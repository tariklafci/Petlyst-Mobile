const pool = require('../config/db');

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
      [name]
    );

    if (rowCount === 0) {
      return res.status(404).send('Appointment not found');
    }

    const { appointment_id, video_meeting, appointment_start_hour, appointment_end_hour } = rows[0];

    if (!video_meeting) {
      return res.status(403).send('Video meeting not enabled');
    }

    const now = new Date();
    const startTime = new Date(appointment_start_hour);
    const endTime = new Date(appointment_end_hour);

    // If current time is NOT between start and end time, deny
    if (now < startTime || now > endTime) {
      return res.status(403).send('Meeting not active at this time');
    }

    const durationSec = Math.max(0, Math.floor((endTime - startTime) / 1000));
    const isoStart = startTime.toISOString();

    return res.json({
      id:         appointment_id,
      name,
      mail_owner: mail_owner || 'service@meeting.petlyst.com',
      start_time: isoStart,
      duration: durationSec
    });
  } catch (err) {
    console.error('Jitsi reservation error:', err);
    return res.status(500).send('Internal server error');
  }
};
