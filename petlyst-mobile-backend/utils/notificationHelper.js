const fetch = require('node-fetch');
const cron = require('node-cron');
const { pool } = require('../config/db'); // adjust your db pool path

// Send notification to multiple expo tokens
async function sendPushNotifications(expoTokens, title, body) {
  if (expoTokens.length === 0) return;

  const messages = expoTokens.map(token => ({
    to: token,
    sound: 'default',
    title,
    body,
    data: { notificationType: 'appointmentReminder' }
  }));

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(messages)
    });

    const data = await response.json();
    console.log('Expo push response:', data);

    // OPTIONAL: handle invalid tokens here and clean your DB if needed
  } catch (error) {
    console.error('Error sending push notifications:', error);
  }
}

// Main function to check appointments and notify users
async function notifyTodayAppointments() {
  const client = await pool.connect();
  console.log('Running appointment notification job at', new Date().toISOString());

  try {
    const today = new Date();
    const yyyy = today.getUTCFullYear();
    const mm = String(today.getUTCMonth() + 1).padStart(2, '0'); // Months start from 0
    const dd = String(today.getUTCDate()).padStart(2, '0');
    const todayDate = `${yyyy}-${mm}-${dd}`; // Format YYYY-MM-DD

    console.log('Checking appointments for date:', todayDate);

    // Fetch today's appointments
    const { rows: appointments } = await client.query(`
      SELECT appointment_id, pet_owner_id, appointment_start_hour
      FROM appointments
      WHERE appointment_date = $1
        AND appointment_status = 'pending'
    `, [todayDate]);

    console.log('Found appointments:', appointments.length);

    for (const appointment of appointments) {
      const { pet_owner_id, appointment_start_hour } = appointment;

      // Fetch expo tokens for this pet owner
      const { rows: tokensResult } = await client.query(
        'SELECT user_expo_token FROM user_tokens WHERE user_id = $1',
        [pet_owner_id]
      );

      const expoTokens = tokensResult.map(row => row.user_expo_token);

      // Format time nicely for the notification
      const time = new Date(appointment_start_hour).toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit'
      });

      const title = "Appointment Reminder";
      const body = `You have an appointment today at {time}`;

      await sendPushNotifications(expoTokens, title, body);
    }

  } catch (error) {
    console.error('Error checking appointments:', error);
  } finally {
    client.release();
  }
}

// Schedule this function to run at 5AM UTC every day
cron.schedule('0 5 * * *', () => {
  notifyTodayAppointments();
});

console.log('Appointment reminder service scheduled.');
