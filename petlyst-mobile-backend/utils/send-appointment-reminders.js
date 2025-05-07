const pool = require('../config/db');
const transporter = require('../config/nodemailer'); // your existing email setup
const { sendPushNotifications } = require('./notificationHelper');

async function sendAppointmentReminders() {
  const now = new Date();
  const fiveMinutesLater = new Date(now.getTime() + 5 * 60 * 1000);

  try {
    const { rows: appointments } = await pool.query(`
      SELECT
        a.appointment_id,
        a.appointment_start_hour,
        a.appointment_date,
        a.user_id,
        a.vet_id,
        c.clinic_name,
        p.pet_name,
        u.user_email as owner_email,
        v.user_email as vet_email
      FROM appointments a
      LEFT JOIN users u ON a.user_id = u.user_id
      LEFT JOIN users v ON a.vet_id = v.user_id
      LEFT JOIN clinics c ON a.clinic_id = c.clinic_id
      LEFT JOIN pets p ON a.pet_id = p.pet_id
      WHERE a.appointment_start_hour BETWEEN $1 AND $2
        AND a.status = 'confirmed'
        AND a.reminder_sent IS NOT TRUE
    `, [now, fiveMinutesLater]);

    for (const appt of appointments) {
      const title = 'Appointment Reminder';
      const body = `Upcoming appointment for ${appt.pet_name} at ${appt.clinic_name} in 5 minutes.`;

      // Push notifications
      const { rows: tokenRows } = await pool.query(`
        SELECT user_token_expo FROM user_tokens
        WHERE user_id IN ($1, $2)
      `, [appt.user_id, appt.vet_id]);

      const expoTokens = tokenRows.map(r => r.user_token_expo).filter(Boolean);
      if (expoTokens.length) {
        await sendPushNotifications(expoTokens, title, body, {
          type: 'appointment_reminder',
          appointmentId: appt.appointment_id,
        });
      }

      // Email
      const mailOptions = {
        from: {
          name: 'Petlyst Reminders',
          address: process.env.EMAIL_USER,
        },
        to: [appt.owner_email, appt.vet_email],
        subject: 'Petlyst Appointment Reminder',
        html: `
          <p>This is a reminder for your upcoming appointment at <strong>${appt.clinic_name}</strong>.</p>
          <p><strong>Pet:</strong> ${appt.pet_name}<br/>
          <strong>Time:</strong> ${new Date(appt.appointment_start_hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        `,
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log(`Reminder email sent for appointment ${appt.appointment_id}`);
      } catch (err) {
        console.error(`Email failed for appointment ${appt.appointment_id}:`, err.message);
      }

      // Mark as sent
      await pool.query(
        `UPDATE appointments SET reminder_sent = TRUE WHERE appointment_id = $1`,
        [appt.appointment_id]
      );
    }

    if (!appointments.length) {
      console.log('No appointments to remind at this time.');
    }
  } catch (err) {
    console.error('Error in sendAppointmentReminders:', err);
  }
}

sendAppointmentReminders();
