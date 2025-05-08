const pool = require('../config/db');
const { generatePresignedUrlClinic } = require('../utils/s3Helpers');

// Fetch all clinics with complete details
exports.fetchClinics = async (req, res) => {
  try {
    // Get query parameters for potential filtering
    const { search, type, rating, province } = req.query;
    
    // Base query to join all necessary tables
    let query = `
      WITH clinic_ratings AS (
        SELECT 
          clinic_id,
          ROUND(AVG((clinic_review_hygiene_rating + clinic_review_stuff_behaviour_rating + clinic_review_price_rating) / 3.0)::numeric, 1) AS average_rating,
          COUNT(*) AS review_count
        FROM reviews
        WHERE approval_status = 'approved'
        GROUP BY clinic_id
      ),
      clinic_services AS (
        SELECT 
          cms.clinic_id,
          ARRAY_AGG(ms.service_name) AS services
        FROM clinic_medical_services cms
        JOIN medical_services ms ON cms.medical_service_id = ms.medical_service_id
        GROUP BY cms.clinic_id
      )
      SELECT 
        c.clinic_id,
        c.clinic_name,
        c.clinic_email,
        c.clinic_description,
        c.opening_time,
        c.closing_time,
        c.clinic_verification_status,
        c.establishment_year,
        c.show_phone_number,
        c.allow_direct_messages,
        c.show_mail_address,
        c.allow_online_meetings,
        c.available_days,
        c.emergency_available_days,
        c.clinic_time_slots,
        c.is_open_24_7,
        c.clinic_type,
        c.clinic_operator_id,
        ca.clinic_album_photo_id,
        ca.clinic_album_photo_url,
        cpn.phone_number,
        cpn.phone_type,
        csm.platform,
        csm.url,
        cl.province,
        cl.district,
        cl.clinic_address,
        cl.latitude,
        cl.longitude,
        cs.services AS medical_services,
        cr.average_rating,
        cr.review_count
      FROM clinics c
      LEFT JOIN clinic_albums ca ON c.clinic_id = ca.clinic_id
      LEFT JOIN clinic_phone_numbers cpn ON c.clinic_id = cpn.clinic_id
      LEFT JOIN clinic_social_media csm ON c.clinic_id = csm.clinic_id
      LEFT JOIN clinic_locations cl ON c.clinic_id = cl.clinic_id
      LEFT JOIN clinic_services cs ON c.clinic_id = cs.clinic_id
      LEFT JOIN clinic_ratings cr ON c.clinic_id = cr.clinic_id
      WHERE c.clinic_verification_status = 'verified'
    `;

    // Add search filtering if provided
    const queryParams = [];
    if (search) {
      queryParams.push(`%${search}%`);
      query += ` AND (
        c.clinic_name ILIKE $${queryParams.length} OR 
        c.clinic_description ILIKE $${queryParams.length} OR
        cl.clinic_address ILIKE $${queryParams.length}
      )`;
    }

    // Add type filtering if provided
    if (type) {
      queryParams.push(type);
      query += ` AND c.clinic_type = $${queryParams.length}`;
    }

    // Add province filtering if provided
    if (province) {
      queryParams.push(province);
      query += ` AND cl.province = $${queryParams.length}`;
    }

    // Add rating filtering if provided
    if (rating) {
      const minRating = parseFloat(rating);
      if (!isNaN(minRating)) {
        queryParams.push(minRating);
        query += ` AND cr.average_rating >= $${queryParams.length}`;
      }
    }

    // Order and execute the query
    query += ` ORDER BY cr.average_rating DESC NULLS LAST, c.clinic_name`;
    const result = await pool.query(query, queryParams);

    // Process the raw results into a structured format
    const clinicsMap = new Map();

    for (const row of result.rows) {
      const clinicId = row.clinic_id;

      // Initialize clinic object if not already in the map
      if (!clinicsMap.has(clinicId)) {
        clinicsMap.set(clinicId, {
          id: clinicId,
          name: row.clinic_name,
          email: row.show_mail_address ? row.clinic_email : null,
          description: row.clinic_description,
          opening_time: row.opening_time,
          closing_time: row.closing_time,
          verification_status: row.clinic_verification_status,
          establishment_year: row.establishment_year,
          show_phone_number: row.show_phone_number,
          allow_direct_messages: row.allow_direct_messages,
          allow_online_meetings: row.allow_online_meetings,
          available_days: row.available_days,
          emergency_available_days: row.emergency_available_days,
          clinic_time_slots: row.clinic_time_slots,
          is_open_24_7: row.is_open_24_7,
          type: row.clinic_type,
          operator_id: row.clinic_operator_id,
          photos: [],
          phone_numbers: [],
          social_media: [],
          location: {
            province: row.province,
            district: row.district,
            address: row.clinic_address,
            latitude: row.latitude,
            longitude: row.longitude
          },
          medical_services: row.medical_services || [],
          average_rating: row.average_rating ? parseFloat(row.average_rating) : null,
          total_reviews: row.review_count || 0,
          allows_video_meetings: row.allow_online_meetings
        });
      }

      const clinic = clinicsMap.get(clinicId);

      // Add photo if available and not already added
      if (row.clinic_album_photo_id && row.clinic_album_photo_url) {
        const photoExists = clinic.photos.some(p => p.photo_id === row.clinic_album_photo_id);
        if (!photoExists) {
          clinic.photos.push({
            photo_id: row.clinic_album_photo_id,
            s3_url: row.clinic_album_photo_url,
          });
        }
      }

      // Add phone number if available and not already added
      if (row.phone_number && row.show_phone_number && !clinic.phone_numbers.some(p => p.number === row.phone_number)) {
        clinic.phone_numbers.push({
          number: row.phone_number,
          type: row.phone_type
        });
      }

      // Add social media link if available and not already added
      if (row.platform && row.url && !clinic.social_media.some(s => s.platform === row.platform && s.url === row.url)) {
        clinic.social_media.push({
          platform: row.platform,
          url: row.url
        });
      }
    }

    // Convert the Map to an array of clinics
    const clinics = Array.from(clinicsMap.values());

    // Generate presigned URLs for all clinic photos
    await Promise.all(
      clinics.map(async (clinic) => {
        clinic.photos = await Promise.all(
          clinic.photos.map(async (photo) => {
            try {
              // Extract the S3 key from the URL
              const s3Key = photo.s3_url.split('.amazonaws.com/')[1];
              const presignedUrl = await generatePresignedUrlClinic(s3Key);
              return {
                ...photo,
                presigned_url: presignedUrl,
              };
            } catch (error) {
              console.error(
                `Failed to generate presigned URL for photo_id: ${photo.photo_id}`,
                error
              );
              return {
                ...photo,
                presigned_url: null,
              };
            }
          })
        );
      })
    );

    res.json(clinics);
  } catch (error) {
    console.error('Error fetching clinics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Fetch a single clinic by ID
exports.fetchClinic = async (req, res) => {
  try {
    const { clinic_id } = req.query;
    
    if (!clinic_id) {
      return res.status(400).json({ error: 'Clinic ID is required' });
    }
    
    // Use the same query structure as fetchClinics but filter for a single clinic
    const query = `
      WITH clinic_ratings AS (
        SELECT 
          clinic_id,
          ROUND(AVG((clinic_review_hygiene_rating + clinic_review_stuff_behaviour_rating + clinic_review_price_rating) / 3.0)::numeric, 1) AS average_rating,
          COUNT(*) AS review_count
        FROM reviews
        WHERE approval_status = 'approved'
        GROUP BY clinic_id
      ),
      clinic_services AS (
        SELECT 
          cms.clinic_id,
          ARRAY_AGG(ms.service_name) AS services
        FROM clinic_medical_services cms
        JOIN medical_services ms ON cms.medical_service_id = ms.medical_service_id
        GROUP BY cms.clinic_id
      )
      SELECT 
        c.clinic_id,
        c.clinic_name,
        c.clinic_email,
        c.clinic_description,
        c.opening_time,
        c.closing_time,
        c.clinic_verification_status,
        c.establishment_year,
        c.show_phone_number,
        c.allow_direct_messages,
        c.show_mail_address,
        c.allow_online_meetings,
        c.available_days,
        c.emergency_available_days,
        c.clinic_time_slots,
        c.is_open_24_7,
        c.clinic_type,
        c.clinic_operator_id,
        ca.clinic_album_photo_id,
        ca.clinic_album_photo_url,
        cpn.phone_number,
        cpn.phone_type,
        csm.platform,
        csm.url,
        cl.province,
        cl.district,
        cl.clinic_address,
        cl.latitude,
        cl.longitude,
        cs.services AS medical_services,
        cr.average_rating,
        cr.review_count
      FROM clinics c
      LEFT JOIN clinic_albums ca ON c.clinic_id = ca.clinic_id
      LEFT JOIN clinic_phone_numbers cpn ON c.clinic_id = cpn.clinic_id
      LEFT JOIN clinic_social_media csm ON c.clinic_id = csm.clinic_id
      LEFT JOIN clinic_locations cl ON c.clinic_id = cl.clinic_id
      LEFT JOIN clinic_services cs ON c.clinic_id = cs.clinic_id
      LEFT JOIN clinic_ratings cr ON c.clinic_id = cr.clinic_id
      WHERE c.clinic_id = $1
    `;
    
    const result = await pool.query(query, [clinic_id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Clinic not found' });
    }
    
    // Process the data the same way as in fetchClinics
    const clinicsMap = new Map();
    
    for (const row of result.rows) {
      const clinicId = row.clinic_id;
      
      if (!clinicsMap.has(clinicId)) {
        clinicsMap.set(clinicId, {
          id: clinicId,
          name: row.clinic_name,
          email: row.show_mail_address ? row.clinic_email : null,
          description: row.clinic_description,
          opening_time: row.opening_time,
          closing_time: row.closing_time,
          clinic_opening_hour: row.opening_time, // Include these fields for appointment screen
          clinic_closing_hour: row.closing_time,
          verification_status: row.clinic_verification_status,
          establishment_year: row.establishment_year,
          show_phone_number: row.show_phone_number,
          allow_direct_messages: row.allow_direct_messages,
          allow_online_meetings: row.allow_online_meetings,
          available_days: row.available_days,
          emergency_available_days: row.emergency_available_days,
          clinic_time_slots: row.clinic_time_slots,
          is_open_24_7: row.is_open_24_7,
          type: row.clinic_type,
          operator_id: row.clinic_operator_id,
          photos: [],
          phone_numbers: [],
          social_media: [],
          location: {
            province: row.province,
            district: row.district,
            address: row.clinic_address,
            latitude: row.latitude,
            longitude: row.longitude
          },
          medical_services: row.medical_services || [],
          average_rating: row.average_rating ? parseFloat(row.average_rating) : null,
          total_reviews: row.review_count || 0,
          allows_video_meetings: row.allow_online_meetings
        });
      }
      
      const clinic = clinicsMap.get(clinicId);
      
      if (row.clinic_album_photo_id && row.clinic_album_photo_url) {
        const photoExists = clinic.photos.some(p => p.photo_id === row.clinic_album_photo_id);
        if (!photoExists) {
          clinic.photos.push({
            photo_id: row.clinic_album_photo_id,
            s3_url: row.clinic_album_photo_url,
          });
        }
      }
      
      if (row.phone_number && row.show_phone_number && !clinic.phone_numbers.some(p => p.number === row.phone_number)) {
        clinic.phone_numbers.push({
          number: row.phone_number,
          type: row.phone_type
        });
      }
      
      if (row.platform && row.url && !clinic.social_media.some(s => s.platform === row.platform && s.url === row.url)) {
        clinic.social_media.push({
          platform: row.platform,
          url: row.url
        });
      }
    }
    
    // Get the single clinic from the map
    const clinic = clinicsMap.values().next().value;
    
    // Generate presigned URLs for all clinic photos
    clinic.photos = await Promise.all(
      clinic.photos.map(async (photo) => {
        try {
          const s3Key = photo.s3_url.split('.amazonaws.com/')[1];
          const presignedUrl = await generatePresignedUrlClinic(s3Key);
          return {
            ...photo,
            presigned_url: presignedUrl,
          };
        } catch (error) {
          console.error(`Failed to generate presigned URL for photo_id: ${photo.photo_id}`, error);
          return {
            ...photo,
            presigned_url: null,
          };
        }
      })
    );
    
    res.json({ clinic, message: 'Clinic details fetched successfully' });
  } catch (error) {
    console.error('Error fetching clinic:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.fetchClinicsAppointment = async (req, res) => {
  try {
    const { clinic_id } = req.query;

    if (!clinic_id) {
      return res.status(400).json({ error: 'Clinic ID is required' });
    }

    const query = `
      SELECT 
        clinic_name,
        opening_time::TEXT AS opening_hour, 
        closing_time::TEXT AS closing_hour, 
        allow_online_meetings, 
        available_days, 
        emergency_available_days, 
        clinic_time_slots,
        is_open_24_7
      FROM clinics
      WHERE clinic_id = $1
    `;

    const result = await pool.query(query, [clinic_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Clinic not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching clinic info:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.fetchClinicsVeterinarian = async (req, res) => {
  try {
    const veterinarian_id = Number(req.query.veterinarian_id);

    if (!veterinarian_id) {
      return res.status(400).json({ error: 'Veterinarian ID is required' });
    }

    const query = `
      SELECT clinic_id
      FROM clinic_veterinarians
      WHERE veterinarian_id = $1
    `;

    const result = await pool.query(query, [veterinarian_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Clinic not found' });
    }

    res.json(result.rows[0]); // Send clinic data as JSON

  } catch (error) {
    console.error('Error fetching clinic id:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.fetchClinicCoordinates = async (req, res) => {
  try {
    const { clinic_id } = req.query;

    if (!clinic_id) {
      return res.status(400).json({ error: 'Clinic ID is required' });
    }

    const query = `
      SELECT province, district, clinic_address, latitude, longitude
      FROM clinic_locations
      WHERE clinic_id = $1
    `;

    const result = await pool.query(query, [clinic_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Clinic location not found' });
    }

    res.json(result.rows[0]); // Send clinic data as JSON

  } catch (error) {
    console.error('Error fetching clinic id:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Clinic Hospitalization Rooms
exports.fetchClinicHospitalizationRooms = async (req, res) => {
  try {
    const userId = req.user.sub;
    
    const clinicId = (await pool.query('SELECT clinic_id FROM clinic_veterinarians WHERE veterinarian_id = $1', [userId])).rows[0].clinic_id;


    if (!clinicId) {
      return res.status(400).json({ error: 'No clinic associated with this user' });
    }
    
    const query = `
      SELECT 
        id,
        clinic_id,
        room_name,
        room_type,
        room_status,
        created_at,
        updated_at
      FROM clinic_hospitalization_rooms
      WHERE clinic_id = $1
      ORDER BY room_name
    `;
    
    const { rows } = await pool.query(query, [clinicId]);
    
    res.json(rows);
  } catch (error) {
    console.error('Error fetching hospitalization rooms:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Clinic Patients
exports.fetchClinicPatients = async (req, res) => {
  try {
    const userId = req.user.sub;
    
    // Get clinic ID for the veterinarian
    const clinicResult = await pool.query(
      'SELECT clinic_id FROM clinic_veterinarians WHERE veterinarian_id = $1',
      [userId]
    );

    if (clinicResult.rows.length === 0) {
      return res.status(400).json({ error: 'No clinic associated with this user' });
    }

    const clinicId = clinicResult.rows[0].clinic_id;
    
    // Get all patients for the clinic with their pet details
    const query = `
      SELECT 
        cp.id,
        cp.clinic_id,
        cp.pet_id,
        cp.created_at,
        cp.updated_at,
        p.pet_name,
        p.pet_species,
        p.pet_breed
      FROM clinic_patients cp
      JOIN pets p ON cp.pet_id = p.pet_id
      WHERE cp.clinic_id = $1
      ORDER BY cp.created_at DESC
    `;
    
    const { rows } = await pool.query(query, [clinicId]);

    console.log("pets:", rows);
    
    res.json(rows);
  } catch (error) {
    console.error('Error fetching clinic patients:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Pet Examinations
exports.fetchPetExaminations = async (req, res) => {
  try {
    const { petId } = req.params;
    console.log("petId:", petId);
    
    if (!petId) {
      return res.status(400).json({ error: 'Pet ID is required' });
    }
    
    const userId = req.user.sub;

    const clinicId = (await pool.query('SELECT clinic_id FROM clinic_veterinarians WHERE veterinarian_id = $1', [userId])).rows[0].clinic_id;
    
    if (!clinicId) {
      return res.status(400).json({ error: 'No clinic associated with this user' });
    }
    
    // First verify that this pet is a patient at this clinic
    const patientCheck = `
      SELECT id FROM clinic_patients
      WHERE clinic_id = $1 AND pet_id = $2
    `;
    
    const patientResult = await pool.query(patientCheck, [clinicId, petId]);
    
    if (patientResult.rows.length === 0) {
      return res.status(403).json({ error: 'This pet is not a patient at your clinic' });
    }
    
    const query = `
      SELECT 
        examination_id,
        pet_id,
        vet_id,
        examination_date,
        status,
        temperature,
        heart_rate,
        respiratory_rate,
        weight,
        notes,
        appointment_id,
        created_at,
        updated_at
      FROM examinations
      WHERE pet_id = $1
      ORDER BY examination_date DESC
    `;
    
    const { rows } = await pool.query(query, [petId]);
    
    res.json(rows);
  } catch (error) {
    console.error(`Error fetching examinations for pet ${req.params.petId}:`, error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Examination Diagnoses
exports.fetchExaminationDiagnoses = async (req, res) => {
  try {
    const { examinationId } = req.params;
    
    if (!examinationId) {
      return res.status(400).json({ error: 'Examination ID is required' });
    }
    
    const userId = req.user.sub;
    const clinicId = (await pool.query('SELECT clinic_id FROM clinic_veterinarians WHERE veterinarian_id = $1', [userId])).rows[0].clinic_id;
    
    if (!clinicId) {
      return res.status(400).json({ error: 'No clinic associated with this user' });
    }
    
    // First verify that this examination is for a pet that's a patient at this clinic
    const examinationCheck = `
      SELECT e.examination_id
      FROM examinations e
      JOIN clinic_patients cp ON e.pet_id = cp.pet_id
      WHERE e.examination_id = $1 AND cp.clinic_id = $2
    `;
    
    const examinationResult = await pool.query(examinationCheck, [examinationId, clinicId]);
    
    if (examinationResult.rows.length === 0) {
      return res.status(403).json({ error: 'You are not authorized to access this examination' });
    }
    
    const query = `
      SELECT 
        diagnosis_id,
        examination_id,
        diagnosis_type,
        diagnosis_code,
        diagnosis_name,
        description,
        diagnosis_date,
        severity,
        notes,
        created_at,
        updated_at
      FROM diagnoses
      WHERE examination_id = $1
      ORDER BY diagnosis_date
    `;
    
    const { rows } = await pool.query(query, [examinationId]);
    
    res.json(rows);
  } catch (error) {
    console.error(`Error fetching diagnoses for examination ${req.params.examinationId}:`, error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Fetch all pet hospitalizations for the clinic
exports.fetchPetHospitalizations = async (req, res) => {
  try {
    const userId = req.user.sub;
    
    // Get clinic ID for the veterinarian
    const clinicResult = await pool.query(
      'SELECT clinic_id FROM clinic_veterinarians WHERE veterinarian_id = $1',
      [userId]
    );

    if (clinicResult.rows.length === 0) {
      return res.status(400).json({ error: 'No clinic associated with this user' });
    }

    const clinicId = clinicResult.rows[0].clinic_id;
    
    const query = `
      SELECT 
        ph.id,
        ph.room_id,
        ph.pet_id,
        ph.admission_date,
        ph.expected_discharge_date,
        ph.actual_discharge_date,
        ph.created_at,
        ph.updated_at,
        chr.room_name,
        chr.room_type,
        p.pet_name,
        p.pet_species,
        p.pet_breed
      FROM pet_hospitalizations ph
      JOIN clinic_hospitalization_rooms chr ON ph.room_id = chr.id
      JOIN pets p ON ph.pet_id = p.pet_id
      WHERE chr.clinic_id = $1
      ORDER BY ph.admission_date DESC
    `;
    
    const { rows } = await pool.query(query, [clinicId]);
    
    res.json(rows);
  } catch (error) {
    console.error('Error fetching pet hospitalizations:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Fetch hospitalization details for a specific room
exports.fetchRoomHospitalization = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.sub;
    
    // Get clinic ID for the veterinarian
    const clinicResult = await pool.query(
      'SELECT clinic_id FROM clinic_veterinarians WHERE veterinarian_id = $1',
      [userId]
    );

    if (clinicResult.rows.length === 0) {
      return res.status(400).json({ error: 'No clinic associated with this user' });
    }

    const clinicId = clinicResult.rows[0].clinic_id;
    
    // Verify room belongs to this clinic
    const roomCheck = await pool.query(
      'SELECT id FROM clinic_hospitalization_rooms WHERE id = $1 AND clinic_id = $2',
      [roomId, clinicId]
    );
    
    if (roomCheck.rows.length === 0) {
      return res.status(403).json({ error: 'This room does not belong to your clinic' });
    }
    
    // Get active hospitalization (no discharge date)
    const query = `
      SELECT 
        ph.id,
        ph.room_id,
        ph.pet_id,
        ph.admission_date,
        ph.expected_discharge_date,
        ph.actual_discharge_date,
        ph.created_at,
        ph.updated_at,
        p.pet_name,
        p.pet_species,
        p.pet_breed
      FROM pet_hospitalizations ph
      JOIN pets p ON ph.pet_id = p.pet_id
      WHERE ph.room_id = $1 AND ph.actual_discharge_date IS NULL
      ORDER BY ph.admission_date DESC
      LIMIT 1
    `;
    
    const { rows } = await pool.query(query, [roomId]);
    
    if (rows.length === 0) {
      // No active hospitalization
      return res.json(null);
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error(`Error fetching hospitalization for room ${req.params.roomId}:`, error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Create a new pet hospitalization
exports.createPetHospitalization = async (req, res) => {
  try {
    const { roomId, petId, admissionDate, expectedDischargeDate } = req.body;
    
    if (!roomId || !petId || !admissionDate) {
      return res.status(400).json({ error: 'Room ID, Pet ID, and Admission Date are required' });
    }
    
    const userId = req.user.sub;
    
    // Get clinic ID for the veterinarian
    const clinicResult = await pool.query(
      'SELECT clinic_id FROM clinic_veterinarians WHERE veterinarian_id = $1',
      [userId]
    );

    if (clinicResult.rows.length === 0) {
      return res.status(400).json({ error: 'No clinic associated with this user' });
    }

    const clinicId = clinicResult.rows[0].clinic_id;
    
    // Verify room belongs to this clinic and is vacant
    const roomCheck = await pool.query(
      'SELECT id, room_status FROM clinic_hospitalization_rooms WHERE id = $1 AND clinic_id = $2',
      [roomId, clinicId]
    );
    
    if (roomCheck.rows.length === 0) {
      return res.status(403).json({ error: 'This room does not belong to your clinic' });
    }
    
    if (roomCheck.rows[0].room_status !== 'vacant') {
      return res.status(400).json({ error: 'This room is not vacant' });
    }
    
    // Verify pet is a patient at this clinic
    const petCheck = await pool.query(
      'SELECT id FROM clinic_patients WHERE pet_id = $1 AND clinic_id = $2',
      [petId, clinicId]
    );
    
    if (petCheck.rows.length === 0) {
      return res.status(403).json({ error: 'This pet is not a patient at your clinic' });
    }
    
    // Begin transaction
    await pool.query('BEGIN');
    
    // Create hospitalization record
    const hospitalizationQuery = `
      INSERT INTO pet_hospitalizations (
        room_id, 
        pet_id, 
        admission_date, 
        expected_discharge_date
      )
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `;
    
    const hospitalizationValues = [
      roomId,
      petId,
      admissionDate,
      expectedDischargeDate || null
    ];
    
    const hospitalizationResult = await pool.query(hospitalizationQuery, hospitalizationValues);
    
    // Update room status to occupied
    const updateRoomQuery = `
      UPDATE clinic_hospitalization_rooms
      SET room_status = 'occupied', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    
    await pool.query(updateRoomQuery, [roomId]);
    
    // Commit transaction
    await pool.query('COMMIT');
    
    res.status(201).json({
      id: hospitalizationResult.rows[0].id,
      message: 'Pet hospitalized successfully'
    });
  } catch (error) {
    // Rollback in case of error
    await pool.query('ROLLBACK');
    console.error('Error creating pet hospitalization:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Discharge a pet
exports.dischargePet = async (req, res) => {
  try {
    const { hospitalizationId } = req.params;
    const { actualDischargeDate } = req.body;
    
    if (!hospitalizationId) {
      return res.status(400).json({ error: 'Hospitalization ID is required' });
    }
    
    const dischargeDate = actualDischargeDate || new Date().toISOString();
    
    const userId = req.user.sub;
    
    // Get clinic ID for the veterinarian
    const clinicResult = await pool.query(
      'SELECT clinic_id FROM clinic_veterinarians WHERE veterinarian_id = $1',
      [userId]
    );

    if (clinicResult.rows.length === 0) {
      return res.status(400).json({ error: 'No clinic associated with this user' });
    }

    const clinicId = clinicResult.rows[0].clinic_id;
    
    // Verify hospitalization belongs to this clinic
    const hospitalizationCheck = `
      SELECT ph.id, ph.room_id
      FROM pet_hospitalizations ph
      JOIN clinic_hospitalization_rooms chr ON ph.room_id = chr.id
      WHERE ph.id = $1 AND chr.clinic_id = $2 AND ph.actual_discharge_date IS NULL
    `;
    
    const hospitalizationResult = await pool.query(hospitalizationCheck, [hospitalizationId, clinicId]);
    
    if (hospitalizationResult.rows.length === 0) {
      return res.status(403).json({ 
        error: 'This hospitalization record does not exist, does not belong to your clinic, or the pet has already been discharged' 
      });
    }
    
    const roomId = hospitalizationResult.rows[0].room_id;
    
    // Begin transaction
    await pool.query('BEGIN');
    
    // Update hospitalization record with discharge date
    const updateHospitalizationQuery = `
      UPDATE pet_hospitalizations
      SET actual_discharge_date = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;
    
    await pool.query(updateHospitalizationQuery, [dischargeDate, hospitalizationId]);
    
    // Update room status to vacant
    const updateRoomQuery = `
      UPDATE clinic_hospitalization_rooms
      SET room_status = 'vacant', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    
    await pool.query(updateRoomQuery, [roomId]);
    
    // Commit transaction
    await pool.query('COMMIT');
    
    res.json({
      message: 'Pet discharged successfully',
      discharge_date: dischargeDate
    });
  } catch (error) {
    // Rollback in case of error
    await pool.query('ROLLBACK');
    console.error(`Error discharging pet from hospitalization ${req.params.hospitalizationId}:`, error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

