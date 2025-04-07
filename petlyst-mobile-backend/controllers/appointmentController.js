const pool = require('../config/db');

exports.createAppointment = async (req, res) => {
    const { video_meeting, pet_id, appointment_start_hour, appointment_status, notes, appointment_end_hour, appointment_date, clinic_id } = req.body;
    const userId = req.user.sub;

    try {
        // Log the incoming date values for debugging
        console.log('Received appointment data:', {
            appointment_date,
            appointment_start_hour,
            appointment_end_hour
        });

        const insertQuery = `
      INSERT INTO appointments (video_meeting, pet_id, appointment_start_hour, appointment_status, notes, appointment_end_hour, appointment_date, clinic_id, pet_owner_id)
      VALUES ($1, $2, $3::timestamp, $4, $5, $6::timestamp, $7::date, $8, $9)
      RETURNING *;
    `;
        const values = [video_meeting, pet_id, appointment_start_hour, appointment_status, notes, appointment_end_hour, appointment_date, clinic_id, userId];
        const result = await pool.query(insertQuery, values);

        res
            .status(201)
            .json({ message: 'Appointment created successfully', pet: result.rows[0] });
    } catch (error) {
        console.error('Error creating appointment:', error);
        res.status(500).json({ error: 'Failed to create appointment' });
    }
};
