const pool = require('../config/db');
const { generatePresignedUrlClinic } = require('../utils/s3Helpers');

// Fetch clinics
exports.fetchClinics = async (req, res) => {
  try {
    const query = `
      SELECT 
        c.clinic_id AS clinic_id,
        c.clinic_name AS name,
        c.clinic_address AS address,
        c.clinic_phone AS phone_number,
        c.clinic_verification_status AS verification_status,
        c.clinic_operator_id AS operator_id,
        c.available_days,
        c.emergency_available_days,
        c.opening_time,
        c.closing_time,
        c.clinic_location AS location,
        cap.clinic_album_photo_id AS photo_id,
        cap.clinic_album_photo_url AS s3_url,
        cap.clinic_album_photo_url_created_at AS created_at
      FROM clinics AS c
      LEFT JOIN clinic_album_photos AS cap
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
        phone_number,
        verification_status,
        operator_id,
        location,
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
          phone_number,
          verification_status,
          operator_id,
          location,
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
