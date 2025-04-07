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

exports.fetchAppointments = async (req, res) => {
    const userId = req.user.sub;
    const { status } = req.query;
    
    try {
        // Build the query based on the filter status
        let queryText = `
            SELECT 
                a.appointment_id,
                a.appointment_date,
                a.appointment_start_hour,
                a.appointment_end_hour,
                a.appointment_status,
                a.video_meeting,
                a.notes,
                p.pet_name,
                p.pet_species,
                p.pet_breed,
                p.pet_photo,
                c.clinic_name,
                c.clinic_address,
                c.clinic_photo
            FROM 
                appointments a
            JOIN 
                pets p ON a.pet_id = p.pet_id
            JOIN 
                clinics c ON a.clinic_id = c.clinic_id
            WHERE 
                a.pet_owner_id = $1
        `;
        
        // Add status filter if provided
        const queryParams = [userId];
        if (status && ['pending', 'active', 'completed'].includes(status.toLowerCase())) {
            queryText += ` AND a.appointment_status = $2`;
            queryParams.push(status.toLowerCase());
        }
        
        // Add order by clause
        queryText += ` ORDER BY a.appointment_date ASC, a.appointment_start_hour ASC`;
        
        const result = await pool.query(queryText, queryParams);
        
        // Format the response data
        const appointments = result.rows.map(appointment => {
            // Format the date for display
            const date = new Date(appointment.appointment_date);
            const formattedDate = date.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short', 
                day: 'numeric'
            });
            
            // Format start and end times for display
            const startTime = new Date(appointment.appointment_start_hour);
            const endTime = new Date(appointment.appointment_end_hour);
            const formattedStartTime = startTime.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
            const formattedEndTime = endTime.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
            
            return {
                id: appointment.appointment_id,
                date: formattedDate,
                rawDate: appointment.appointment_date,
                startTime: formattedStartTime,
                endTime: formattedEndTime,
                status: appointment.appointment_status,
                isVideoMeeting: appointment.video_meeting,
                notes: appointment.notes,
                pet: {
                    name: appointment.pet_name,
                    species: appointment.pet_species,
                    breed: appointment.pet_breed,
                    photo: appointment.pet_photo
                },
                clinic: {
                    name: appointment.clinic_name,
                    address: appointment.clinic_address,
                    photo: appointment.clinic_photo
                }
            };
        });
        
        res.status(200).json({ appointments });
    } catch (error) {
        console.error('Error fetching appointments:', error);
        res.status(500).json({ error: 'Failed to fetch appointments' });
    }
};
