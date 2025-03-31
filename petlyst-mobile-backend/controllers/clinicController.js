const pool = require('../config/db');
const { generatePresignedUrlClinic } = require('../utils/s3Helpers');

// Fetch clinics
exports.fetchClinics = async (req, res) => {
  try {
    const query = `
      SELECT 
        c.clinic_id AS clinic_id,
        c.clinic_name AS clinic_name,
        c.clinic_email AS clinic_email,
        c.clinic_address AS clinic_address,
        c.clinic_operator_id AS clinic_operator_id,
        c.clinic_description AS clinic_description,
        c.opening_time AS clinic_opening_time,
        c.closing_time AS clinic_closing_time,
        c.establishment_year AS clinic_establishment_year,
        c.show_phone_number AS clinic_show_phone_number,
        c.show_mail_address AS clinic_show_mail_address,
        c.allow_online_meetings AS clinic_allow_online_meetings,
        c.clinic_verification_status AS clinic_verification_status,
        c.clinic_operator_id AS operator_id,
        c.available_days AS clinic_available_days,
        c.emergency_available_days AS clinic_emergency_available_days,
        c.is_open_24_7 AS clinic_is_open_24_7,
        c.clinic_type AS clinic_type,
        cap.clinic_album_photo_id AS photo_id,
        cap.clinic_album_photo_url AS s3_url,
      FROM clinics AS c
      LEFT JOIN clinic_albums AS cap
        ON c.clinic_id = cap.clinic_id
      ORDER BY c.clinic_id;
    `;
    const { rows } = await pool.query(query);

    const clinics = [];
    const clinicMap = new Map();

    for (const row of rows) {
      const {
        clinic_id,
        clinic_name,
        clinic_email,
        clinic_address,
        clinic_operator_id,
        clinic_description,
        clinic_opening_time,
        clinic_closing_time,
        clinic_establishment_year,
        clinic_show_phone_number,
        clinic_show_mail_address,
        clinic_allow_online_meetings,
        clinic_verification_status,
        operator_id,
        clinic_available_days,
        clinic_emergency_available_days,
        clinic_is_open_24_7,
        clinic_type,
        photo_id,
        s3_url,
        created_at,
      } = row;

      if (!clinicMap.has(clinic_id)) {
        const clinic = {
          id: clinic_id,
          name: clinic_name,
          email: clinic_email,
          address: clinic_address,
          operator_id: operator_id,
          description: clinic_description,
          opening_time: clinic_opening_time,
          closing_time: clinic_closing_time,
          establishment_year: clinic_establishment_year,
          show_phone_number: clinic_show_phone_number,
          show_mail_address: clinic_show_mail_address,
          allow_online_meetings: clinic_allow_online_meetings,
          verification_status: clinic_verification_status,
          available_days: clinic_available_days,
          emergency_available_days: clinic_emergency_available_days,
          is_open_24_7: clinic_is_open_24_7,
          clinic_type: clinic_type,
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
