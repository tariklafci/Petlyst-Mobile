const pool = require('../config/db');

// Istanbul is always +1 hour ahead of Frankfurt in April
const TURKEY_OFFSET_MINUTES_FROM_FRANKFURT = 60; // 1 hour * 60 mins

exports.createConference = async (req, res) => {
  const { name, start_time, mail_owner } = req.body;

  try {
    const { rowCount, rows } = await pool.query(
      `SELECT 
         appointment_id,
         video_meeting,
         appointment_start_hour,
         appointment_end_hour
       FROM appointments
       WHERE meeting_url = $1`,
      [name] // adjust if needed
    );

    if (rowCount === 0) {
      console.log('No appointment found for name:', name);
      return res.status(404).send('Appointment not found');
    }

    const { appointment_id, video_meeting, appointment_start_hour, appointment_end_hour } = rows[0];

    if (!video_meeting) {
      console.log('Video meeting disabled');
      return res.status(403).send('Video meeting not enabled');
    }

    const now = new Date();

    const startTime = new Date(appointment_start_hour);
    const endTime = new Date(appointment_end_hour);

    // Shift server time to "Istanbul perspective" (+1 hour)
    const nowInTurkey = new Date(now.getTime() + TURKEY_OFFSET_MINUTES_FROM_FRANKFURT * 60000);

    console.log('Now (server Frankfurt time):', now.toISOString());
    console.log('Now (adjusted Turkey view):', nowInTurkey.toISOString());
    console.log('Appointment Start (Frankfurt time):', startTime.toISOString());
    console.log('Appointment End (Frankfurt time):', endTime.toISOString());

    if (nowInTurkey < startTime || nowInTurkey > endTime) {
      console.log('Current Istanbul time is NOT within appointment window');
      return res.status(403).send('Meeting not active at this time');
    }

    const durationSec = Math.max(0, Math.floor((endTime - startTime) / 1000));
    const isoStart = startTime.toISOString();

    return res.json({
      id:         appointment_id,
      name,                     // room name exactly as Prosody requested
      mail_owner: mail_owner || 'service@meeting.petlyst.com',
      start_time: isoStart,
      duration:   durationSec
    });
  } catch (err) {
    console.error('Jitsi reservation error:', err);
    return res.status(500).send('Internal server error');
  }
};
