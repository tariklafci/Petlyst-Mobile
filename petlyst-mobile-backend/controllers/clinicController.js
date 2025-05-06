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
        (SELECT AVG(rating) FROM clinic_reviews WHERE clinic_id = c.clinic_id) AS average_rating,
        (SELECT COUNT(*) FROM clinic_reviews WHERE clinic_id = c.clinic_id) AS total_reviews
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

