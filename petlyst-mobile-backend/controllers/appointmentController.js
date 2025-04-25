const pool = require('../config/db');

exports.createAppointment = async (req, res) => {
    const { video_meeting, pet_id, appointment_start_hour, appointment_status, notes, appointment_end_hour, appointment_date, clinic_id } = req.body;
    const userId = req.user.sub;

    try {

        // Ensure dates are properly formatted for PostgreSQL
        // PostgreSQL expects 'YYYY-MM-DD' for dates
        const formattedDate = appointment_date.split('T')[0]; // Remove any time component if present
        

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

        res
            .status(201)
            .json({ message: 'Appointment created successfully', pet: result.rows[0] });
    } catch (error) {
        console.error('Error creating appointment:', error);
        res.status(500).json({ error: 'Failed to create appointment' });
    }
};

exports.fetchAppointments = async (req, res) => {
    const userId    = req.user.sub;
    const { status, clinic_id } = req.query;
  
    try {
      // start building your SELECT…
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
          c.clinic_id,
          c.clinic_name,
          c.clinic_address
        FROM appointments a
        JOIN pets    p ON a.pet_id    = p.pet_id
        JOIN clinics c ON a.clinic_id = c.clinic_id
        WHERE
      `;
  
      const params = [];
      let idx = 1;
  
      // if the client passed clinic_id, filter on that…
      if (clinic_id) {
        queryText += ` a.clinic_id = $${idx}`;
        params.push(Number(clinic_id));
      }
      // otherwise default to the pet‐owner’s appointments
      else {
        queryText += ` a.pet_owner_id = $${idx}`;
        params.push(userId);
      }
      idx++;
  
      // add status filter if present
      if (
        status &&
        ['pending', 'confirmed', 'completed'].includes(status.toLowerCase())
      ) {
        queryText += ` AND a.appointment_status = $${idx}`;
        params.push(status.toLowerCase());
        idx++;
      }
  
      // finalize ordering
      queryText += `
        ORDER BY
          a.appointment_date    ASC,
          a.appointment_start_hour ASC
      `;
  
      const { rows } = await pool.query(queryText, params);
  
      const appointments = rows.map(a => {
        // …format exactly as you do today…
        const date = new Date(a.appointment_date);
        const formattedDate = date.toLocaleDateString('en-US', {
          weekday: 'short', month: 'short', day: 'numeric'
        });
        const startTime = new Date(a.appointment_start_hour).toLocaleTimeString('en-US', {
          hour: '2-digit', minute: '2-digit', hour12: true
        });
        const endTime = new Date(a.appointment_end_hour).toLocaleTimeString('en-US', {
          hour: '2-digit', minute: '2-digit', hour12: true
        });
        return {
          id:        a.appointment_id,
          date:      formattedDate,
          rawDate:   a.appointment_date,
          startTime,
          endTime,
          status:    a.appointment_status,
          isVideoMeeting: a.video_meeting,
          notes:     a.notes,
          pet: {
            name:    a.pet_name,
            species: a.pet_species,
            breed:   a.pet_breed,
            photo:   a.pet_photo
          },
          clinic: {
            id:      a.clinic_id,
            name:    a.clinic_name,
            address: a.clinic_address
          }
        };
      });
  
      res.status(200).json({ appointments });
    }
    catch (err) {
      console.error('Error fetching appointments:', err);
      res.status(500).json({ error: 'Failed to fetch appointments' });
    }
  };
  
