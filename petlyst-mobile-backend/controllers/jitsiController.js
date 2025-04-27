// controllers/jitsiController.js
const pool = require('../db');

exports.createConference = async (req, res) => {
  const { name /* roomName */, start_time, mail_owner } = req.body;

  try {
    // Grab start + end timestamps from the DB
    const { rowCount, rows } = await pool.query(
      `SELECT 
         appointment_id,
         video_meeting,
         appointment_start_hour,
         appointment_end_hour
       FROM appointments
       WHERE meeting_url = $1`,
      [name]
    );

    if (rowCount === 0) {
      return res.status(404).send('Appointment not found');
    }

    const { appointment_id, video_meeting, appointment_start_hour, appointment_end_hour } = rows[0];
    if (!video_meeting) {
      return res.status(403).send('Video meeting not enabled');
    }

    // Compute duration in seconds from your start/end columns
    const startMs = new Date(appointment_start_hour).getTime();
    const endMs   = new Date(appointment_end_hour).getTime();
    const durationSec = Math.max(0, Math.floor((endMs - startMs) / 1000));

    // ISO-format the start_time for Jitsi
    const isoStart = new Date(appointment_start_hour).toISOString();

    return res.json({
      id:         appointment_id,
      name,
      mail_owner: mail_owner || 'service@meeting.petlyst.com',
      start_time: isoStart,
      duration:   durationSec
    });
  } catch (err) {
    console.error('Jitsi reservation error:', err);
    return res.status(500).send('Internal server error');
  }
};
