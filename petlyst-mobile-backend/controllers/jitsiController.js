const pool = require('../config/db');
const moment = require('moment-timezone');

exports.createConference = async (req, res) => {
  const { name, mail_owner } = req.body;
  const nice_name = name
  .split("-")
  .map(part => {
    return isNaN(part) ? part.charAt(0).toUpperCase() + part.slice(1) : part;
  })
  .join("-");
  console.log('🚨 /conference endpoint was hit!', req.body);

  try {
    const { rowCount, rows } = await pool.query(
      `SELECT 
         appointment_id,
         video_meeting,
         appointment_start_hour,
         appointment_end_hour
       FROM appointments
       WHERE meeting_url = $1`,
      [nice_name]
    );

    if (rowCount === 0) {
      return res.status(404).send('Appointment not found');
    }

    const { appointment_id, video_meeting, appointment_start_hour, appointment_end_hour } = rows[0];

    if (!video_meeting) {
      return res.status(403).send('Video meeting not enabled');
    }

    const nowUtc = moment.utc(); // server current UTC time

    // Correctly parse as Turkey time, then work in UTC
    const startMoment = moment.tz(
      moment(appointment_start_hour).format('YYYY-MM-DD HH:mm:ss'),
      'Europe/Istanbul'
    );

    const endMoment = moment.tz(
      moment(appointment_end_hour).format('YYYY-MM-DD HH:mm:ss'),
      'Europe/Istanbul'
    );
    console.log(`End time: ${endMoment.clone().utc()}`);



    if (nowUtc.isBefore(startMoment.clone().utc()) || nowUtc.isAfter(endMoment.clone().utc())) {
      return res.status(403).send('Meeting not active at this time');
    }

    const durationSec = Math.max(0, endMoment.diff(startMoment, 'seconds'));
    const isoStart = startMoment.clone().utc().toISOString();
    console.log(`Start time: ${isoStart}`);


    return res.json({
      id: appointment_id,
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
