const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');

/**
 * Create a new appointment
 * Expected request body:
 * - pet_id: The ID of the pet for the appointment
 * - video_meeting: Boolean indicating if this is a video meeting
 * - appointment_start_hour: ISO timestamp for appointment start
 * - appointment_end_hour: ISO timestamp for appointment end
 * - notes: Text notes for the appointment (optional)
 * - appointment_date: Date of the appointment in YYYY-MM-DD format
 */
exports.createAppointment = async (req, res) => {
  const { 
    pet_id, 
    video_meeting, 
    appointment_start_hour, 
    appointment_end_hour, 
    notes, 
    appointment_date 
  } = req.body;
  const user_id = req.user.userId; // from the auth middleware

  console.log('Received appointment data:', JSON.stringify(req.body, null, 2));

  // Validate required fields
  if (!pet_id || !appointment_start_hour || !appointment_end_hour || !appointment_date) {
    return res.status(400).json({ 
      success: false,
      message: 'Missing required fields. Please provide pet_id, appointment_start_hour, appointment_end_hour, and appointment_date.'
    });
  }

  try {
    // First, verify that the pet belongs to this user
    const petVerificationQuery = 'SELECT * FROM pets WHERE pet_id = $1 AND user_id = $2';
    const petVerificationResult = await pool.query(petVerificationQuery, [pet_id, user_id]);
    
    if (petVerificationResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You can only make appointments for your own pets.'
      });
    }

    // Generate a meeting URL and password if this is a video meeting
    let meeting_url = null;
    let meeting_password = null;
    const videoMeetingValue = video_meeting === true; // Ensure boolean
    
    if (videoMeetingValue) {
      // Simple UUID-based link for demonstration purposes
      // In a production app, you'd integrate with a video conferencing API
      meeting_url = `https://petlyst.com/meet/${uuidv4()}`;
      meeting_password = Math.random().toString(36).substring(2, 10).toUpperCase(); // Random alphanumeric password
    }

    // Try to determine the column names and types in the appointments table
    try {
      const tableInfoQuery = `
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'appointments'
      `;
      const tableInfo = await pool.query(tableInfoQuery);
      console.log('Appointments table columns:', tableInfo.rows);
    } catch (infoError) {
      console.warn('Could not fetch table info:', infoError.message);
    }

    // First, try the most basic query with only the critical fields
    // This minimizes chances of SQL errors with column mismatches
    const query = `
      INSERT INTO appointments (
        pet_id,
        video_meeting,
        appointment_start_hour,
        appointment_end_hour,
        appointment_date,
        notes
      ) 
      VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING *
    `;

    const values = [
      pet_id,
      videoMeetingValue,
      appointment_start_hour,
      appointment_end_hour,
      appointment_date,
      notes || ''
    ];

    console.log('Executing SQL with values:', JSON.stringify(values, null, 2));
    
    const result = await pool.query(query, values);
    console.log('SQL result:', result.rows[0]);

    // After succeeding with basic insert, update with additional fields if needed
    if (result.rows.length > 0 && (meeting_url || meeting_password)) {
      const appointmentId = result.rows[0].appointment_id;
      const updateQuery = `
        UPDATE appointments 
        SET meeting_url = $1, meeting_password = $2 
        WHERE appointment_id = $3
        RETURNING *
      `;
      
      try {
        const updateResult = await pool.query(updateQuery, 
          [meeting_url, meeting_password, appointmentId]
        );
        console.log('Updated with meeting details:', updateResult.rows[0]);
      } catch (updateError) {
        console.warn('Could not update meeting details:', updateError.message);
        // Continue anyway as the basic appointment was created
      }
    }

    // Return the successful response
    return res.status(201).json({
      success: true,
      message: 'Appointment created successfully',
      appointment: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating appointment:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while creating the appointment',
      error: error.message
    });
  }
};

/**
 * Fetch all appointments for the authenticated user
 */
exports.fetchAppointments = async (req, res) => {
  const user_id = req.user.userId;

  try {
    // Join with pets table to only get appointments for the user's pets
    const query = `
      SELECT a.*, p.pet_name, p.pet_photo, p.pet_breed, p.pet_species
      FROM appointments a
      JOIN pets p ON a.pet_id = p.pet_id
      WHERE p.user_id = $1
      ORDER BY a.appointment_date ASC, a.appointment_start_hour ASC
    `;

    const result = await pool.query(query, [user_id]);

    return res.status(200).json({
      success: true,
      appointments: result.rows
    });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching appointments',
      error: error.message
    });
  }
};

/**
 * Get a specific appointment by ID
 */
exports.getAppointmentById = async (req, res) => {
  const appointment_id = req.params.id;
  const user_id = req.user.userId;

  try {
    // Join with pets to ensure user can only access their own pets' appointments
    const query = `
      SELECT a.*, p.pet_name, p.pet_photo, p.pet_breed, p.pet_species
      FROM appointments a
      JOIN pets p ON a.pet_id = p.pet_id
      WHERE a.appointment_id = $1 AND p.user_id = $2
    `;

    const result = await pool.query(query, [appointment_id, user_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found or you do not have permission to view it'
      });
    }

    return res.status(200).json({
      success: true,
      appointment: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching appointment:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching the appointment',
      error: error.message
    });
  }
};

/**
 * Cancel/delete an appointment
 */
exports.cancelAppointment = async (req, res) => {
  const { appointment_id } = req.body;
  const user_id = req.user.userId;

  if (!appointment_id) {
    return res.status(400).json({
      success: false,
      message: 'Appointment ID is required'
    });
  }

  try {
    // First verify the user owns the pet associated with this appointment
    const verificationQuery = `
      SELECT a.appointment_id 
      FROM appointments a
      JOIN pets p ON a.pet_id = p.pet_id
      WHERE a.appointment_id = $1 AND p.user_id = $2
    `;
    
    const verificationResult = await pool.query(verificationQuery, [appointment_id, user_id]);
    
    if (verificationResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You can only cancel your own appointments'
      });
    }

    // Delete the appointment
    const deleteQuery = 'DELETE FROM appointments WHERE appointment_id = $1 RETURNING *';
    const deleteResult = await pool.query(deleteQuery, [appointment_id]);

    if (deleteResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Appointment cancelled successfully',
      appointment: deleteResult.rows[0]
    });
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while cancelling the appointment',
      error: error.message
    });
  }
};
