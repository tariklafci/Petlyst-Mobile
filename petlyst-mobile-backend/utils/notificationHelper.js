const pool = require('../config/db');
const fetch = global.fetch || require('node-fetch');

// Validate Expo push token format
function isValidExpoToken(token) {
  return typeof token === 'string' &&
         (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[')) &&
         token.endsWith(']');
}

/**
 * Send push notifications to multiple Expo tokens
 * @param {string[]} expoTokens
 * @param {string} title
 * @param {string} body
 * @param {Object} [data={}] Additional data payload
 */
async function sendPushNotifications(expoTokens, title, body, data = {}) {
  if (!Array.isArray(expoTokens) || expoTokens.length === 0) {
    console.log('No tokens to send push notifications to');
    return;
  }

  // Filter out invalid tokens
  const validTokens = expoTokens.filter(isValidExpoToken);
  if (validTokens.length === 0) {
    console.log('No valid Expo tokens after filtering');
    return;
  }

  const messages = validTokens.map(token => ({
    to: token,
    sound: 'default',
    title,
    body,
    data,
    priority: 'high',
    badge: 1
  }));

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
          ...(process.env.EXPO_ACCESS_TOKEN && { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` })
        },
        body: JSON.stringify(chunk)
      });

      if (!response.ok) {
        const errTxt = await response.text();
        console.error('Expo push error:', response.status, errTxt);
        continue;
      }

      const respJson = await response.json();
      if (respJson.errors) {
        console.error('Some Expo push errors:', respJson.errors);
      } else {
        console.log(`Sent ${respJson.data.length} push notifications`);
      }
    } catch (err) {
      console.error('Error sending push chunk:', err);
    }
  }
}

/**
 * Notify a pet owner when their appointment status changes
 * @param {number} userId
 * @param {string} status
 * @param {object} appointmentDetails
 */
async function notifyUserAppointmentStatusChanged(userId, status, appointmentDetails = {}) {
  if (!userId) {
    console.warn('Cannot send notification: Missing user ID');
    return { success: false, error: 'Missing user ID' };
  }

  let client;
  try {
    client = await pool.connect();

    // 1) Fetch Expo tokens
    const { rows: tokenRows } = await client.query(
      'SELECT user_token_expo FROM user_tokens WHERE user_id = $1',
      [userId]
    );
    const expoTokens = tokenRows.map(r => r.user_token_expo).filter(t => typeof t === 'string' && t);
    if (expoTokens.length === 0) {
      console.log(`No push tokens for user ${userId}`);
      return { success: false, error: 'No push tokens' };
    }

    // 2) Default placeholders
    let clinic  = 'the clinic';
    let date    = 'scheduled date';
    let time    = 'scheduled time';
    let petName = 'your pet';

    // 3) Fetch real appointment details if appointmentId provided
    if (appointmentDetails.appointmentId) {
      const apptId = appointmentDetails.appointmentId;
      const { rows: appts } = await client.query(
        `SELECT
           a.appointment_date,
           a.appointment_start_hour,
           c.clinic_name,
           p.pet_name
         FROM appointments a
         LEFT JOIN clinics c ON a.clinic_id = c.clinic_id
         LEFT JOIN pets    p ON a.pet_id     = p.pet_id
         WHERE a.appointment_id = $1`
      , [apptId]);
      if (appts[0]) {
        const appt = appts[0];
        clinic  = appt.clinic_name || clinic;
        petName = appt.pet_name    || petName;

        const d = new Date(appt.appointment_date);
        if (!isNaN(d)) {
          date = d.toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
          });
        }
        const t = new Date(appt.appointment_start_hour);
        if (!isNaN(t)) {
          time = t.toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit'
          });
        }
      }
    }

    // 4) Override with explicit values
    if (appointmentDetails.clinicName) clinic  = appointmentDetails.clinicName;
    if (appointmentDetails.date)       date    = appointmentDetails.date;
    if (appointmentDetails.time)       time    = appointmentDetails.time;
    if (appointmentDetails.petName)    petName = appointmentDetails.petName;

    // 5) Build notification content
    const s = status.toLowerCase();
    let title, body;
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

    // 6) Send push
    await sendPushNotifications(expoTokens, title, body, {
      type:          'appointment_status_change',
      status:        s,
      appointmentId: appointmentDetails.appointmentId || null,
      clinicId:      appointmentDetails.clinicId     || null,
      petId:         appointmentDetails.petId        || null
    });

    console.log(`Status change notification (${status}) sent to user ${userId}`);
    return { success: true };
  } catch (err) {
    console.error('Error sending status change notification:', err);
    return { success: false, error: err.message };
  } finally {
    if (client) client.release();
  }
}

/**
 * Notify all veterinarians at a clinic about an appointment event
 * @param {number} clinicId
 * @param {string} type 'new' | 'canceled' | 'update'
 * @param {object} appointmentDetails
 */
async function notifyClinicVeterinarians(clinicId, type, appointmentDetails = {}) {
  if (!clinicId) {
    console.warn('Cannot notify veterinarians: Missing clinicId');
    return { success: false, error: 'Missing clinicId' };
  }

  let client;
  try {
    client = await pool.connect();

    // 1) Get all vets for this clinic
    const { rows: vets } = await client.query(
      'SELECT veterinarian_id FROM clinic_veterinarians WHERE clinic_id = $1',
      [clinicId]
    );
    if (!vets.length) {
      console.log(`No veterinarians found for clinic ${clinicId}`);
      return { success: true, count: 0 };
    }

    // 2) Fetch appointment info
    let petName = 'a pet';
    let date    = 'scheduled date';
    let time    = 'scheduled time';

    if (appointmentDetails.appointmentId) {
      const apptId = appointmentDetails.appointmentId;
      const { rows: appts } = await client.query(
        `SELECT p.pet_name, a.appointment_date, a.appointment_start_hour
         FROM appointments a
         LEFT JOIN pets p ON a.pet_id = p.pet_id
         WHERE a.appointment_id = $1`
      , [apptId]);
      if (appts[0]) {
        petName = appts[0].pet_name || petName;
        const d = new Date(appts[0].appointment_date);
        if (!isNaN(d)) date = d.toLocaleDateString('en-US', { weekday:'long', year:'numeric',month:'long',day:'numeric'});
        const t = new Date(appts[0].appointment_start_hour);
        if (!isNaN(t)) time = t.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
      }
    }

    // 3) Prepare title & body
    let title, body;
    switch (type) {
      case 'new':
        title = 'New Appointment Request';
        body  = `New appointment for ${petName} on ${date} at ${time}.`;
        break;
      case 'canceled':
        title = 'Appointment Canceled';
        body  = `Appointment for ${petName} on ${date} at ${time} was canceled.`;
        break;
      default:
        title = 'Appointment Update';
        body  = `Appointment for ${petName} on ${date} at ${time} was updated.`;
    }

    // 4) Notify each veterinarian
    let count = 0;
    for (const { veterinarian_id } of vets) {
      const { rows: tokenRows } = await client.query(
        'SELECT user_token_expo FROM user_tokens WHERE user_id = $1',
        [veterinarian_id]
      );
      const expoTokens = tokenRows.map(r => r.user_token_expo).filter(t => typeof t === 'string' && t);
      if (expoTokens.length) {
        await sendPushNotifications(expoTokens, title, body, {
          type:          'vet_appointment_notification',
          action:        type,
          appointmentId: appointmentDetails.appointmentId || null,
          clinicId
        });
        count++;
      }
    }

    console.log(`Sent notifications to ${count} veterinarians for clinic ${clinicId}`);
    return { success: true, count };
  } catch (err) {
    console.error('Error notifying veterinarians:', err);
    return { success: false, error: err.message };
  } finally {
    if (client) client.release();
  }
}

/**
 * Send a test notification to a single user
 */
async function sendTestNotification(userId) {
  let client;
  try {
    client = await pool.connect();
    const { rows: tokenRows } = await client.query(
      'SELECT user_token_expo FROM user_tokens WHERE user_id = $1',
      [userId]
    );
    const expoTokens = tokenRows.map(r => r.user_token_expo).filter(t => typeof t === 'string' && t);
    if (!expoTokens.length) {
      console.log(`No push tokens for test user ${userId}`);
      return { success: false, message: 'No tokens' };
    }

    await sendPushNotifications(
      expoTokens,
      'Test Notification',
      'This is a test notification from Petlyst',
      { test: true }
    );
    return { success: true, message: 'Test notification sent' };
  } catch (err) {
    console.error('Error in sendTestNotification:', err);
    return { success: false, message: err.message };
  } finally {
    if (client) client.release();
  }
}

module.exports = {
  isValidExpoToken,
  sendPushNotifications,
  notifyUserAppointmentStatusChanged,
  notifyClinicVeterinarians,
  sendTestNotification
};