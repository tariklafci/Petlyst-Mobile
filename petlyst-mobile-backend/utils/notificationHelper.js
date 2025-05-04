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

/**
 * Send notification to user about appointment status change
 * @param {number} userId - User ID to send notification to
 * @param {string} status - New appointment status (e.g. 'confirmed', 'canceled', etc.)
 * @param {object} appointmentDetails - Optional overrides and/or appointmentId
 *    { appointmentId?: number,
 *      clinicName?: string,
 *      date?: string,
 *      time?: string,
 *      petName?: string }
 */
async function notifyUserAppointmentStatusChanged(userId, status, appointmentDetails = {}) {
  if (!userId) {
    console.warn('Cannot send notification: Missing user ID');
    return { success: false, error: 'Missing user ID' };
  }

  let client;
  try {
    client = await pool.connect();

    // 1) Fetch user tokens
    const { rows: tokenRows } = await client.query(
      'SELECT user_token_expo FROM user_tokens WHERE user_id = $1',
      [userId]
    );
    const expoTokens = tokenRows
      .map(r => r.user_token_expo)
      .filter(t => typeof t === 'string' && t.length > 0);

    if (expoTokens.length === 0) {
      console.log(`No push tokens found for user ID: ${userId}`);
      return { success: false, error: 'No push tokens' };
    }

    // 2) Default placeholders
    let clinic   = 'the clinic';
    let date     = 'scheduled date';
    let time     = 'scheduled time';
    let petName  = 'your pet';

    // 3) If we have an appointmentId, fetch real details
    if (appointmentDetails.appointmentId) {
      const apptId = appointmentDetails.appointmentId;
      const { rows } = await client.query(`
        SELECT 
          a.appointment_date,
          a.appointment_start_hour,
          c.name       AS clinic_name,
          p.pet_name
        FROM appointments a
        LEFT JOIN clinics c ON a.clinic_id = c.id
        LEFT JOIN pets    p ON a.pet_id     = p.pet_id
        WHERE a.appointment_id = $1
      `, [apptId]);

      if (rows.length > 0) {
        const appt = rows[0];
        if (appt.clinic_name)       clinic  = appt.clinic_name;
        if (appt.pet_name)          petName = appt.pet_name;

        // format date
        const dt = new Date(appt.appointment_date);
        if (!isNaN(dt.getTime())) {
          date = dt.toLocaleDateString('en-US', {
            weekday: 'long',
            year:    'numeric',
            month:   'long',
            day:     'numeric'
          });
        }
        // format time
        const tt = new Date(appt.appointment_start_hour);
        if (!isNaN(tt.getTime())) {
          time = tt.toLocaleTimeString('en-US', {
            hour:   '2-digit',
            minute: '2-digit'
          });
        }
      }
    }

    // 4) Override with any explicitly provided details
    if (appointmentDetails.clinicName) clinic  = appointmentDetails.clinicName;
    if (appointmentDetails.date)       date    = appointmentDetails.date;
    if (appointmentDetails.time)       time    = appointmentDetails.time;
    if (appointmentDetails.petName)    petName = appointmentDetails.petName;

    // 5) Build title & body
    let title, body;
    const s = status.toLowerCase();
    switch (s) {
      case 'confirmed':
        title = 'Appointment Confirmed';
        body  = `Your appointment for ${petName} at ${clinic} on ${date} at ${time} has been confirmed.`;
        break;
      case 'completed':
        title = 'Appointment Completed';
        body  = `Your appointment for ${petName} at ${clinic} has been marked as completed.`;
        break;
      case 'canceled':
      case 'cancelled':
        title = 'Appointment Canceled';
        body  = `Your appointment for ${petName} at ${clinic} on ${date} at ${time} has been canceled.`;
        break;
      case 'rejected':
        title = 'Appointment Rejected';
        body  = `Your appointment request for ${petName} at ${clinic} has been rejected.`;
        break;
      default:
        title = 'Appointment Update';
        body  = `Your appointment for ${petName} at ${clinic} has been updated to: ${status}.`;
    }

    // 6) Fire off the notification
    await sendPushNotifications(expoTokens, title, body, {
      type:          'appointment_status_change',
      status:        s,
      appointmentId: appointmentDetails.appointmentId || null,
      clinicId:      appointmentDetails.clinicId     || null,
      petId:         appointmentDetails.petId        || null
    });

    console.log(`Status change notification (${status}) sent to user ${userId}`);
    return { success: true };

  } catch (error) {
    console.error('Error sending status change notification:', error);
    return { success: false, error: error.message };

  } finally {
    if (client) {
      try { client.release(); }
      catch (_) { /* ignore */ }
    }
  }
}

/**
 * Notify all veterinarians at a clinic about a new or updated appointment
 * @param {number} clinicId - ID of the clinic
 * @param {string} type - Type of notification (new, canceled, etc)
 * @param {object} appointmentDetails - Details of the appointment
 */
async function notifyClinicVeterinarians(clinicId, type, appointmentDetails) {
  let client;
  
  try {
    if (!clinicId) {
      console.warn('Cannot send notification: Missing clinic ID');
      return;
    }
    
    client = await pool.connect();
    
    // Get all veterinarians working at this clinic
    const { rows: vets } = await client.query(`
      SELECT veterinarian_id 
      FROM clinic_veterinarians 
      WHERE clinic_id = $1
    `, [clinicId]);
    
    if (!vets || vets.length === 0) {
      console.log(`No veterinarians found for clinic ID: ${clinicId}`);
      return;
    }
    
    // Prepare basic appointment info
    let date = 'scheduled date';
    let time = 'scheduled time';
    let petName = 'a pet';
    let ownerName = 'a client';
    
    // Try to get appointment details
    if (appointmentDetails && appointmentDetails.appointmentId) {
      try {
        const { rows } = await client.query(`
          SELECT 
            a.appointment_date, 
            a.appointment_start_hour, 
            p.pet_name,
            CONCAT(u.name, ' ', u.surname) AS owner_name
          FROM appointments a
          LEFT JOIN pets p ON a.pet_id = p.pet_id
          LEFT JOIN users u ON a.pet_owner_id = u.id
          WHERE a.appointment_id = $1
        `, [appointmentDetails.appointmentId]);
        
        if (rows.length > 0) {
          const appt = rows[0];
          
          if (appt.appointment_date) {
            const apptDate = new Date(appt.appointment_date);
            if (!isNaN(apptDate.getTime())) {
              date = apptDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              });
            }
          }
          
          if (appt.appointment_start_hour) {
            const startTime = new Date(appt.appointment_start_hour);
            if (!isNaN(startTime.getTime())) {
              time = startTime.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
              });
            }
          }
          
          if (appt.pet_name) petName = appt.pet_name;
          if (appt.owner_name) ownerName = appt.owner_name;
        }
      } catch (dbError) {
        console.error('Error fetching appointment details for vets:', dbError);
      }
    }
    
    // Prepare notification content
    let title, body;
    
    switch(type.toLowerCase()) {
      case 'new':
        title = 'New Appointment Request';
        body = `${ownerName} has requested a new appointment for ${petName} on ${date} at ${time}.`;
        break;
      case 'canceled':
        title = 'Appointment Canceled';
        body = `${ownerName} has canceled the appointment for ${petName} on ${date} at ${time}.`;
        break;
      default:
        title = 'Appointment Update';
        body = `An appointment for ${petName} on ${date} at ${time} has been updated.`;
    }
    
    const data = {
      type: 'vet_appointment_notification',
      action: type.toLowerCase(),
      appointmentId: appointmentDetails?.appointmentId || null,
      clinicId: clinicId
    };
    
    // Send notification to each veterinarian
    let notificationCount = 0;
    
    for (const vet of vets) {
      try {
        const { rows: tokens } = await client.query(
          'SELECT user_token_expo FROM user_tokens WHERE user_id = $1',
          [vet.veterinarian_id]
        );
        
        const expoTokens = tokens
          .map(row => row.user_token_expo)
          .filter(token => token && typeof token === 'string');
          
        if (expoTokens.length > 0) {
          await sendPushNotifications(expoTokens, title, body, data);
          notificationCount++;
        }
      } catch (vetError) {
        console.error(`Error sending notification to vet ${vet.veterinarian_id}:`, vetError);
      }
    }
    
    console.log(`Sent notifications to ${notificationCount} veterinarians at clinic ${clinicId}`);
    return { success: true, count: notificationCount };
  } catch (error) {
    console.error('Error notifying clinic veterinarians:', error);
    return { success: false, error: error.message };
  } finally {
    if (client) {
      try {
        client.release();
      } catch (releaseError) {
        console.error('Error releasing client:', releaseError);
      }
    }
  }
}

// Export all functions
module.exports = {
  notifyTodayAppointments,
  sendPushNotifications,
  sendTestNotification,
  notifyUserAppointmentStatusChanged,
  notifyClinicVeterinarians
};
  
