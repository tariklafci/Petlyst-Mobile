const pool = require('../config/db');

// Istanbul is UTC+3 normally (standard time), 
// or UTC+3 all year if no DST changes (Turkey does not use DST now).
const ISTANBUL_OFFSET_MINUTES = -180; // minus because getTimezoneOffset returns negative for ahead-of-UTC

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
      [`https://meeting.petlyst.com/${name}`]  // <-- CAREFUL: build the full URL if your DB stores full meeting_url
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

    // Create "virtual UTC" versions of start/end assuming they are Istanbul local times
    const startTime = new Date(new Date(appointment_start_hour).getTime() - ISTANBUL_OFFSET_MINUTES * 60000);
    const endTime   = new Date(new Date(appointment_end_hour).getTime() - ISTANBUL_OFFSET_MINUTES * 60000);

    console.log('Now UTC:', now.toISOString());
    console.log('Adjusted StartTime:', startTime.toISOString());
    console.log('Adjusted EndTime:', endTime.toISOString());

    // If current time is NOT between start and end time, deny
    if (now < startTime || now > endTime) {
      console.log('Current UTC time is not within Istanbul appointment window');
      return res.status(403).send('Meeting not active at this time');
    }

    const durationSec = Math.max(0, Math.floor((endTime - startTime) / 1000));
    const isoStart = startTime.toISOString();

    return res.json({
      id:         appointment_id,
      name,                     // must match the original room name
      mail_owner: mail_owner || 'service@meeting.petlyst.com',
      start_time: isoStart,
      duration:   durationSec
    });
  } catch (err) {
    console.error('Jitsi reservation error:', err);
    return res.status(500).send('Internal server error');
  }
};
