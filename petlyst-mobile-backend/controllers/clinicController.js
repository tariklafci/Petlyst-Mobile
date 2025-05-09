const pool = require('../config/db');
const { generatePresignedUrlClinic } = require('../utils/s3Helpers');

// Fetch clinics
exports.fetchClinics = async (req, res) => {
  try {
    const query = `
      SELECT 
        c.clinic_id AS id,
        c.clinic_name AS name,
        c.clinic_email AS email,
        c.clinic_address AS address,
        c.clinic_operator_id,
        c.clinic_description AS description,
        c.opening_time,
        c.closing_time,
        c.establishment_year,
        c.show_phone_number,
        c.show_mail_address,
        c.allow_direct_messages,
        c.allow_online_meetings,
        c.clinic_verification_status AS verification_status,
        c.available_days,
        c.emergency_available_days,
        c.is_open_24_7,
        c.clinic_time_slots,
        c.clinic_type AS type,
        c.clinic_creation_status,
        c.clinic_operator_id AS operator_id,
        cap.clinic_album_photo_id AS photo_id,
        cap.clinic_album_photo_url AS s3_url,
        cpn.phone_number,
        cpn.phone_type,
        csm.platform AS social_media_platform,
        csm.url AS social_media_url,
        cl.province,
        cl.district,
        cl.clinic_address AS location_address,
        cl.latitude,
        cl.longitude,
        (SELECT ARRAY_AGG(ms.service_name) 
          FROM clinic_medical_services cms 
          JOIN medical_services ms ON cms.medical_service_id = ms.medical_service_id 
          WHERE cms.clinic_id = c.clinic_id) AS medical_services,
        (CASE WHEN (SELECT COUNT(*) FROM reviews WHERE clinic_id = c.clinic_id) > 0
          THEN (SELECT AVG((clinic_review_hygiene_rating + clinic_review_stuff_behaviour_rating + clinic_review_price_rating) / 3.0)
               FROM reviews WHERE clinic_id = c.clinic_id)
          ELSE NULL
         END) AS average_rating,
        (SELECT COUNT(*) FROM reviews WHERE clinic_id = c.clinic_id) AS total_reviews
      FROM clinics AS c
      LEFT JOIN clinic_albums AS cap ON c.clinic_id = cap.clinic_id
      LEFT JOIN clinic_phone_numbers AS cpn ON c.clinic_id = cpn.clinic_id
      LEFT JOIN clinic_social_media AS csm ON c.clinic_id = csm.clinic_id
      LEFT JOIN clinic_locations AS cl ON c.clinic_id = cl.clinic_id
      ORDER BY c.clinic_id;
    `;
    const { rows } = await pool.query(query);

    const clinics = [];
    const clinicMap = new Map();

    for (const row of rows) {
      const {
        id,
        name,
        email,
        address,
        clinic_operator_id,
        description,
        opening_time,
        closing_time,
        establishment_year,
        show_phone_number,
        show_mail_address,
        allow_direct_messages,
        allow_online_meetings,
        verification_status,
        available_days,
        emergency_available_days,
        is_open_24_7,
        clinic_time_slots,
        type,
        clinic_creation_status,
        photo_id,
        s3_url,
        phone_number,
        phone_type,
        social_media_platform,
        social_media_url,
        province,
        district,
        location_address,
        latitude,
        longitude,
        medical_services,
        average_rating,
        total_reviews
      } = row;

      if (!clinicMap.has(id)) {
        const clinic = {
          id,
          name,
          email: show_mail_address ? email : null,
          address,
          clinic_operator_id,
          description,
          opening_time,
          closing_time,
          establishment_year,
          show_phone_number,
          show_mail_address,
          allow_direct_messages,
          allow_online_meetings,
          verification_status,
          available_days,
          emergency_available_days,
          is_open_24_7,
          clinic_time_slots,
          type,
          clinic_creation_status,
          operator_id: clinic_operator_id,
          photos: [],
          phone_numbers: [],
          social_media: [],
          location: {
            province,
            district,
            address: location_address || address,
            latitude,
            longitude
          },
          medical_services: medical_services || [],
          average_rating: average_rating ? parseFloat(average_rating) : null,
          total_reviews: total_reviews ? parseInt(total_reviews) : 0,
          allows_video_meetings: allow_online_meetings
        };
        clinicMap.set(id, clinic);
        clinics.push(clinic);
      }

      if (photo_id && s3_url) {
        const existingPhoto = clinicMap.get(id).photos.find(photo => photo.photo_id === photo_id);
        if (!existingPhoto) {
          clinicMap.get(id).photos.push({
            photo_id,
            s3_url,
          });
        }
      }
      
      // Only add phone numbers if show_phone_number is true
      if (phone_number && show_phone_number && !clinicMap.get(id).phone_numbers.some(p => p.number === phone_number)) {
        clinicMap.get(id).phone_numbers.push({
          number: phone_number,
          type: phone_type
        });
      }

      if (social_media_platform && social_media_url) {
        const existingSocialMedia = clinicMap.get(id).social_media.find(
          sm => sm.platform === social_media_platform && sm.url === social_media_url
        );
        
        if (!existingSocialMedia) {
          clinicMap.get(id).social_media.push({
            platform: social_media_platform,
            url: social_media_url
          });
        }
      }
    }

    // Generate presigned URLs for photos
    await Promise.all(
      clinics.map(async (clinic) => {
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
              console.error(
                `Failed to generate presigned URL for photo_id: ${photo.photo_id}, s3_url: ${photo.s3_url}`,
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
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.fetchClinicsAppointment = async (req, res) => {
  try {
      const { clinic_id } = req.query;

      // Validate clinic_id
      if (!clinic_id) {
          return res.status(400).json({ error: 'Clinic ID is required' });
      }

      const query = `
          SELECT 
              clinic_name,
              opening_time::TEXT, 
              closing_time::TEXT, 
              allow_online_meetings, 
              available_days, 
              emergency_available_days, 
              clinic_time_slots
          FROM clinics
          WHERE clinic_id = $1
      `;

      const result = await pool.query(query, [clinic_id]);


      if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Clinic not found' });
      }

      res.json(result.rows[0]); // Send clinic data as JSON

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

