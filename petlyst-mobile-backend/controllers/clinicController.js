const pool = require('../config/db');
const { generatePresignedUrlClinic } = require('../utils/s3Helpers');

// Fetch clinics
exports.fetchClinics = async (req, res) => {
  try {
    const query = `
      SELECT 
        c.id AS clinic_id,
        c.name,
        c.address,
        c.phone_number,
        c.verification_status,
        c.operator_id,
        c.location,
        cp.photo_id,
        cp.created_at,
        cp.s3_url
      FROM clinics AS c
      LEFT JOIN clinic_photos AS cp 
        ON c.id = cp.clinic_id
      ORDER BY c.id;
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
        photo_id,
        created_at,
        s3_url,
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

    await Promise.all(
      clinics.map(async (clinic) => {
        clinic.photos = await Promise.all(
          clinic.photos.map(async (photo) => {
            const s3Key = photo.s3_url.split('.amazonaws.com/')[1];
            const presignedUrl = await generatePresignedUrlClinic(s3Key);
            return {
              ...photo,
              presigned_url: presignedUrl,
            };
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
