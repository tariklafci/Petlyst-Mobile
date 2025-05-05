const pool = require('../config/db');
const generator = require('generate-password');
const {
  notifyUserAppointmentStatusChanged,
  notifyClinicVeterinarians
} = require('../utils/notificationHelper');

/**
 * Create a new appointment and notify veterinarians immediately
 */
exports.createAppointment = async (req, res) => {
  const {
    video_meeting,
    pet_id,
    appointment_start_hour,
    appointment_status,
    notes,
    appointment_end_hour,
    appointment_date,
    clinic_id
  } = req.body;
  const userId = req.user.sub;

  // Generate a meeting URL
  const meeting_url = generator
    .generate({ length: 15, numbers: true, uppercase: false, lowercase: false })
    .match(/.{1,3}/g)
    ?.join('-') ?? '';

  try {
    // Format date for PostgreSQL
    const formattedDate = appointment_date.split('T')[0];

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
        pet_owner_id,
        meeting_url
      ) VALUES (
        $1,
        $2,
        $3::timestamp without time zone,
        $4,
        $5,
        $6::timestamp without time zone,
        $7::date,
        $8,
        $9,
        $10
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
      formattedDate,
      clinic_id,
      userId,
      `Room-ID-${meeting_url}`
    ];

    const result = await pool.query(insertQuery, values);
    const newAppointment = result.rows[0];

    // Notify all veterinarians at this clinic
    try {
      await notifyClinicVeterinarians(clinic_id, 'new', {
        appointmentId: newAppointment.appointment_id
      });
    } catch (notificationError) {
      console.error('Error sending notification to veterinarians:', notificationError);
    }

    res
      .status(201)
      .json({ message: 'Appointment created successfully', appointment: newAppointment });
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
};

/**
 * Fetch appointments for the logged-in pet owner
 */
exports.fetchAppointments = async (req, res) => {
  const userId = req.user.sub;
  const { status } = req.query;

  try {
    let queryText = `
      SELECT
        a.appointment_id,
        a.appointment_date,
        a.appointment_start_hour,
        a.appointment_end_hour,
        a.appointment_status,
        a.video_meeting,
        a.notes,
        a.meeting_url,
        p.pet_name,
        p.pet_species,
        p.pet_breed,
        p.pet_photo,
        c.clinic_name,
        c.clinic_address
      FROM appointments a
      JOIN pets p ON a.pet_id = p.pet_id
      JOIN clinics c ON a.clinic_id = c.clinic_id
      WHERE a.pet_owner_id = $1
    `;

    const queryParams = [userId];
    if (status && ['pending', 'confirmed', 'completed'].includes(status.toLowerCase())) {
      queryText += ` AND a.appointment_status = $2`;
      queryParams.push(status.toLowerCase());
    }
    queryText += ` ORDER BY a.appointment_date ASC, a.appointment_start_hour ASC`;

    const result = await pool.query(queryText, queryParams);

    const appointments = result.rows.map(appointment => {
      const date = new Date(appointment.appointment_date);
      const formattedDate = date.toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric'
      });

      const startTime = new Date(appointment.appointment_start_hour);
      const endTime = new Date(appointment.appointment_end_hour);
      const formattedStartTime = startTime.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', hour12: true
      });
      const formattedEndTime = endTime.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', hour12: true
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
        meeting_url: appointment.meeting_url,
        pet: {
          name: appointment.pet_name,
          species: appointment.pet_species,
          breed: appointment.pet_breed,
          photo: appointment.pet_photo
        },
        clinic: {
          name: appointment.clinic_name,
          address: appointment.clinic_address
        }
      };
    });

    res.status(200).json({ appointments });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
};

/**
 * Fetch appointments for a specific clinic (veterinarian view)
 */
exports.fetchAppointmentsClinic = async (req, res) => {
  const { status, clinicId } = req.query;
  if (!clinicId) {
    return res.status(400).json({ error: 'clinicId is required' });
  }

  try {
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
        c.clinic_address
      FROM appointments a
      JOIN pets p ON a.pet_id = p.pet_id
      JOIN clinics c ON a.clinic_id = c.clinic_id
      WHERE a.clinic_id = $1
    `;

    const queryParams = [clinicId];
    if (status && ['pending', 'confirmed', 'completed'].includes(status.toLowerCase())) {
      queryText += ` AND a.appointment_status = $2`;
      queryParams.push(status.toLowerCase());
    }
    queryText += ` ORDER BY a.appointment_date ASC, a.appointment_start_hour ASC`;

    const result = await pool.query(queryText, queryParams);

    const appointments = result.rows.map(appointment => {
      const date = new Date(appointment.appointment_date);
      const formattedDate = date.toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric'
      });

      const startTime = new Date(appointment.appointment_start_hour);
      const endTime = new Date(appointment.appointment_end_hour);
      const formattedStartTime = startTime.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', hour12: true
      });
      const formattedEndTime = endTime.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', hour12: true
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
          address: appointment.clinic_address
        }
      };
    });

    res.status(200).json({ appointments });
  } catch (error) {
    console.error('Error fetching clinic appointments:', error);
    res.status(500).json({ error: 'Failed to fetch clinic appointments' });
  }
};

/**
 * Cancel an appointment by the pet owner and notify vets + the owner immediately
 */
exports.cancelPendingAppointment = async (req, res) => {
  try {
    const { appointment_id, appointment_status } = req.body;
    const userId = req.user.sub;

    // Get original appointment for vet notification
    const getAppointmentQuery = `
      SELECT appointment_id, clinic_id, appointment_date, appointment_start_hour, pet_id
      FROM appointments
      WHERE appointment_id = $1;
    `;
    const appointmentResult = await pool.query(getAppointmentQuery, [appointment_id]);
    if (!appointmentResult.rows.length) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    const appointmentDetails = appointmentResult.rows[0];

    // Update status
    const updateQuery = `
      UPDATE appointments
      SET appointment_status = $1
      WHERE appointment_id = $2 AND pet_owner_id = $3
      RETURNING *;
    `;
    const result = await pool.query(updateQuery, [
      appointment_status,
      appointment_id,
      userId
    ]);
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Appointment not found or unauthorized' });
    }

    // Notify veterinarians
    try {
      await notifyClinicVeterinarians(appointmentDetails.clinic_id, 'canceled', {
        appointmentId: appointment_id
      });
    } catch (notificationError) {
      console.error('Error sending cancellation notification to veterinarians:', notificationError);
    }

    // Notify owner
    try {
      await notifyUserAppointmentStatusChanged(
        userId,
        appointment_status,
        {
          appointmentId: appointment_id,
          clinicId: appointmentDetails.clinic_id,
          petId: appointmentDetails.pet_id
        }
      );
    } catch (notificationError) {
      console.error('Error sending cancellation notification to user:', notificationError);
    }

    res.status(200).json({
      message: 'Appointment updated successfully',
      appointment: result.rows[0]
    });
  } catch (error) {
    console.error('Error canceling appointment:', error);
    res.status(500).json({ error: 'Failed to cancel appointment' });
  }
};

/**
 * Veterinarian updates appointment status and notify the pet owner immediately
 */
exports.updateAppointmentStatus = async (req, res) => {
  try {
    const { appointment_id, appointment_status } = req.body;
    const veterinarian_id = req.user.sub;

    // Find veterinarian's clinic
    const { rows: clinicRows } = await pool.query(
      'SELECT clinic_id FROM clinic_veterinarians WHERE veterinarian_id = $1',
      [veterinarian_id]
    );
    if (!clinicRows.length) {
      return res.status(404).json({ error: 'Clinic not found for the veterinarian.' });
    }
    const clinic_id = clinicRows[0].clinic_id;

    // Get pet owner
    const { rows: ownerRows } = await pool.query(
      'SELECT pet_owner_id, pet_id FROM appointments WHERE appointment_id = $1',
      [appointment_id]
    );
    if (!ownerRows.length) {
      return res.status(404).json({ error: 'Appointment not found.' });
    }
    const { pet_owner_id, pet_id } = ownerRows[0];

    // Update status
    const updateQuery = `
      UPDATE appointments
      SET appointment_status = $1
      WHERE appointment_id = $2 AND clinic_id = $3
      RETURNING *;
    `;
    const { rows: updatedRows } = await pool.query(updateQuery, [
      appointment_status,
      appointment_id,
      clinic_id
    ]);
    if (!updatedRows.length) {
      return res.status(404).json({ error: 'Appointment not found or unauthorized to update.' });
    }
    const updatedAppointment = updatedRows[0];

    // Notify owner
    try {
      await notifyUserAppointmentStatusChanged(
        pet_owner_id,
        appointment_status,
        {
          appointmentId: appointment_id,
          clinicId: clinic_id,
          petId: pet_id
        }
      );
    } catch (notificationError) {
      console.error('Error sending status update notification to user:', notificationError);
    }

    res.status(200).json({
      message: 'Appointment updated successfully',
      appointment: updatedAppointment
    });
  } catch (error) {
    console.error('Error updating appointment status:', error);
    res.status(500).json({ error: 'Failed to update appointment status' });
  }
};

/**
 * Fetch appointments for a specific clinic on a specific date
 * Used to check which slots are already reserved during appointment booking
 */
exports.fetchClinicAppointmentsByDate = async (req, res) => {
  try {
    const { clinic_id, date } = req.query;
    
    if (!clinic_id) {
      return res.status(400).json({ error: 'clinic_id is required' });
    }
    
    if (!date) {
      return res.status(400).json({ error: 'date is required' });
    }
    
    // Query to get all appointments for this clinic on the specified date
    const queryText = `
      SELECT
        appointment_id,
        appointment_date,
        appointment_start_hour,
        appointment_end_hour,
        appointment_status,
        video_meeting,
        notes,
        meeting_url,
        pet_id,
        clinic_id,
        pet_owner_id
      FROM appointments
      WHERE clinic_id = $1
      AND appointment_date = $2::date
    `;
    
    const result = await pool.query(queryText, [clinic_id, date]);
    
    // Return the appointments data
    res.status(200).json({ 
      appointments: result.rows,
      count: result.rowCount
    });
  } catch (error) {
    console.error('Error fetching clinic appointments by date:', error);
    res.status(500).json({ error: 'Failed to fetch clinic appointments' });
  }
};
