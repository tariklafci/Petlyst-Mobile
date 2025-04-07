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

        // Ensure dates are properly formatted for PostgreSQL
        // PostgreSQL expects 'YYYY-MM-DD' for dates
        const formattedDate = appointment_date.split('T')[0]; // Remove any time component if present
        
        console.log('Formatted appointment date for database:', formattedDate);

        const insertQuery = `
      INSERT INTO appointments (
        video_meeting, 
        pet_id, 
        appointment_start_hour, 
        appointment_status, 
        notes, 
        appointment_end_hour, 
        appointment_date, 
        clinic_id, 
        pet_owner_id
      )
      VALUES (
        $1, 
        $2, 
        $3::timestamp without time zone, 
        $4, 
        $5, 
        $6::timestamp without time zone, 
        $7::date, 
        $8, 
        $9
      )
      RETURNING *;
    `;
        const values = [
            video_meeting, 
            pet_id, 
            appointment_start_hour, 
            appointment_status, 
            notes, 
            appointment_end_hour, 
            formattedDate, // Use the formatted date
            clinic_id, 
            userId
        ];
        
        const result = await pool.query(insertQuery, values);
        console.log('Appointment created with data:', result.rows[0]);

        res
            .status(201)
            .json({ message: 'Appointment created successfully', pet: result.rows[0] });
    } catch (error) {
        console.error('Error creating appointment:', error);
        res.status(500).json({ error: 'Failed to create appointment' });
    }
};
