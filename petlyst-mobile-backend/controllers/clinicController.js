const pool = require('../config/db');
const { generatePresignedUrlClinic } = require('../utils/s3Helpers');

// Fetch clinics
exports.fetchClinics = async (req, res) => {
  try {
    const query = `
      SELECT 
        c.clinic_id AS clinic_id,
        c.clinic_name AS name,
        c.clinic_verification_status AS verification_status,
        c.clinic_operator_id AS operator_id,
        c.available_days,
        c.emergency_available_days,
        c.opening_time,
        c.closing_time,
        cap.clinic_album_photo_id AS photo_id,
        cap.clinic_album_photo_url AS s3_url
      FROM clinics AS c
      LEFT JOIN clinicalbum AS cap
        ON c.clinic_id = cap.clinic_id
      ORDER BY c.clinic_id;
    `;
    const { rows } = await pool.query(query);

    const clinics = [];
    const clinicMap = new Map();

    for (const row of rows) {
      const {
        clinic_id,
        name,
        address,
        verification_status,
        operator_id,
        available_days,
        emergency_available_days,
        opening_time,
        closing_time,
        photo_id,
        s3_url,
        created_at,
      } = row;

      if (!clinicMap.has(clinic_id)) {
        const clinic = {
          id: clinic_id,
          name,
          address,
          verification_status,
          operator_id,
          available_days, // Array of boolean values for each day
          emergency_available_days, // Array of boolean values for emergency days
          opening_time,
          closing_time,
          photos: [],
        };
        clinicMap.set(clinic_id, clinic);
        clinics.push(clinic);
      }

      if (photo_id && s3_url) {
        clinicMap.get(clinic_id).photos.push({
          photo_id,
          created_at,
          s3_url,
        });
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
