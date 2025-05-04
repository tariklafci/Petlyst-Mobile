//notificationHelper.js

const cron = require('node-cron');
const pool = require('../config/db');

// Send notification to multiple expo tokens
const EXPO_ACCESS_TOKEN = process.env.EXPO_ACCESS_TOKEN;

/**
 * Validates expo push tokens to ensure they're in the proper format
 * @param {string} token - The Expo push token to validate
 * @returns {boolean} - Whether the token is valid
 */
function isValidExpoToken(token) {
  return typeof token === 'string' && 
         (token.startsWith('ExponentPushToken[') || 
          token.startsWith('ExpoPushToken[')) && 
         token.endsWith(']');
}

/**
 * Send push notifications to multiple Expo tokens
 * @param {string[]} expoTokens - Array of Expo push tokens
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} [data={}] - Additional data to send with notification
 */
async function sendPushNotifications(expoTokens, title, body, data = {}) {
  try {
    if (!expoTokens || !Array.isArray(expoTokens) || expoTokens.length === 0) {
      console.log('No valid tokens provided for push notification');
      return;
    }

    // Filter out invalid tokens
    const validTokens = expoTokens.filter(token => isValidExpoToken(token));
    
    if (validTokens.length === 0) {
      console.log('No valid expo tokens found after filtering');
      return;
    }

    // Create message payloads
    const messages = validTokens.map(token => ({
      to: token,
      sound: 'default',
      title,
      body,
      data: { 
        notificationType: 'appointmentReminder',
        ...data 
      },
      // Add priority for Android
      priority: 'high',
      // Add badge count for iOS
      badge: 1,
    }));

    // Divide into chunks of 100 (Expo's limit)
    const chunkSize = 100;
    for (let i = 0; i < messages.length; i += chunkSize) {
      const chunk = messages.slice(i, i + chunkSize);
      
      try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
            'Authorization': EXPO_ACCESS_TOKEN ? `Bearer ${EXPO_ACCESS_TOKEN}` : undefined
          },
          body: JSON.stringify(chunk)
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Error response from Expo push service: ${response.status}`, errorText);
          continue;
        }

        const data = await response.json();
        
        // Check for errors in individual message deliveries
        if (data.errors && data.errors.length > 0) {
          console.error('Errors sending some push notifications:', data.errors);
        }
        
        // Log success
        console.log(`Successfully sent ${data.data.length} push notifications`);
      } catch (chunkError) {
        console.error('Error sending push notification chunk:', chunkError);
      }
    }
  } catch (error) {
    console.error('Error in sendPushNotifications function:', error);
  }
}

// Main function to check appointments and notify users
async function notifyTodayAppointments() {
  let client;
  
  try {
    client = await pool.connect();
    
    // Get today's date in a safe way for database comparison
    const today = new Date();
    const yyyy = today.getUTCFullYear();
    const mm = String(today.getUTCMonth() + 1).padStart(2, '0'); // Months start from 0
    const dd = String(today.getUTCDate()).padStart(2, '0');
    const todayDate = `${yyyy}-${mm}-${dd}`; // Format YYYY-MM-DD

    console.log(`Checking appointments for date: ${todayDate}`);

    // Fetch today's appointments
    const { rows: appointments } = await client.query(`
      SELECT 
        appointment_id, 
        pet_owner_id, 
        appointment_start_hour, 
        clinic_id, 
        pet_id,
        appointment_date
      FROM appointments
      WHERE appointment_date = $1
        AND appointment_status = 'confirmed'
    `, [todayDate]);

    console.log(`Found ${appointments.length} appointments for today`);

    if (appointments.length === 0) {
      console.log("No appointments found for today");
      return;
    }

    for (const appointment of appointments) {
      try {
        const { pet_owner_id, appointment_start_hour, clinic_id, pet_id } = appointment;
        
        // Skip appointments with missing critical data
        if (!pet_owner_id) {
          console.warn(`Skipping appointment ${appointment.appointment_id} - missing pet_owner_id`);
          continue;
        }

        console.log(`Processing appointment ${appointment.appointment_id} for user ${pet_owner_id}`);

        // Fetch expo tokens for this pet owner
        const { rows: tokensResult } = await client.query(
          'SELECT user_token_expo FROM user_tokens WHERE user_id = $1',
          [pet_owner_id]
        );

        // Get pet name if available
        let petName = 'your pet';
        try {
          if (pet_id) {
            const { rows: petRows } = await client.query(
              'SELECT pet_name FROM pets WHERE pet_id = $1',
              [pet_id]
            );
            if (petRows && petRows.length > 0 && petRows[0].pet_name) {
              petName = petRows[0].pet_name;
            }
          }
        } catch (petError) {
          console.error('Error fetching pet name:', petError);
        }

        // Get clinic name if available
        let clinicName = 'the clinic';
        try {
          if (clinic_id) {
            const { rows: clinicRows } = await client.query(
              'SELECT name FROM clinics WHERE id = $1',
              [clinic_id]
            );
            if (clinicRows && clinicRows.length > 0 && clinicRows[0].name) {
              clinicName = clinicRows[0].name;
            }
          }
        } catch (clinicError) {
          console.error('Error fetching clinic name:', clinicError);
        }

        if (!tokensResult || tokensResult.length === 0) {
          console.log(`No push tokens found for user ID: ${pet_owner_id}`);
          continue;
        }

        const expoTokens = tokensResult
          .map(row => row.user_token_expo)
          .filter(token => token && typeof token === 'string'); // Filter out null/undefined/non-string tokens

        if (expoTokens.length === 0) {
          console.log(`No valid push tokens found for user ID: ${pet_owner_id}`);
          continue;
        }

        // Format time safely - handling potential invalid dates
        let timeString = "scheduled time";
        try {
          if (appointment_start_hour) {
            // Make a defensive copy of the date to avoid modification issues
            const startTime = new Date(appointment_start_hour);
            if (!isNaN(startTime.getTime())) {
              timeString = startTime.toLocaleTimeString('tr-TR', {
                hour: '2-digit',
                minute: '2-digit'
              });
            }
          }
        } catch (timeError) {
          console.error('Error formatting appointment time:', timeError);
        }

        const title = "Appointment Reminder";
        const body = `You have an appointment for ${petName} at ${clinicName} today at ${timeString}`;
        
        const data = {
          appointmentId: appointment.appointment_id,
          clinicId: clinic_id || null,
          petId: pet_id || null,
          type: 'appointment_reminder'
        };

        console.log(`Sending notification to user ${pet_owner_id} with ${expoTokens.length} tokens`);
        await sendPushNotifications(expoTokens, title, body, data);
        console.log(`Notification sent for appointment ${appointment.appointment_id}`);
      } catch (appointmentError) {
        console.error(`Error processing appointment ${appointment.appointment_id}:`, appointmentError);
        // Continue with next appointment
      }
    }
  } catch (error) {
    console.error('Error in notifyTodayAppointments function:', error);
    throw error; // Re-throw to allow proper error handling in the controller
  } finally {
    if (client) {
      try {
        client.release();
      } catch (releaseError) {
        console.error('Error releasing database client:', releaseError);
      }
    }
  }
}

// Schedule this function to run at 8AM local time every day
// Note: The server timezone matters here
cron.schedule('0 8 * * *', () => {
  console.log('Running scheduled appointment notification job');
  notifyTodayAppointments().catch(error => {
    console.error('Uncaught error in notifyTodayAppointments job:', error);
  });
});

// Add a function for sending immediate notifications for testing
async function sendTestNotification(userId) {
  let client;
  try {
    client = await pool.connect();
    
    // Fetch the user's tokens
    const { rows: tokensResult } = await client.query(
      'SELECT user_token_expo FROM user_tokens WHERE user_id = $1',
      [userId]
    );
    
    const expoTokens = tokensResult
      .map(row => row.user_token_expo)
      .filter(token => token);
      
    if (expoTokens.length === 0) {
      console.log(`No push tokens found for user ID: ${userId}`);
      return { success: false, message: 'No push tokens found for user' };
    }
    
    await sendPushNotifications(
      expoTokens, 
      'Test Notification', 
      'This is a test notification from Petlyst', 
      { testData: true }
    );
    
    return { success: true, message: 'Test notification sent' };
  } catch (error) {
    console.error('Error sending test notification:', error);
    return { success: false, message: error.message };
  } finally {
    if (client) {
      client.release();
    }
  }
}

module.exports = {
  notifyTodayAppointments,
  sendPushNotifications,
  sendTestNotification
};
  
