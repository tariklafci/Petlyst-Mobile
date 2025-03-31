const pool = require('../config/db');

exports.createAppointment = async (req, res) => {
    const { name, breed, birthDate, species } = req.body;
    const userId = req.user.sub;

    try {
        const photo = req.file
            ? await uploadFileToS3(req.file, userId, name)
            : null;

        const insertQuery = `
      INSERT INTO pets (pet_name, pet_breed, pet_birth_date, pet_species, pet_owner_id, pet_photo)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
        const values = [name, breed, birthDate, species, userId, photo];
        const result = await pool.query(insertQuery, values);

        res
            .status(201)
            .json({ message: 'Pet created successfully', pet: result.rows[0] });
    } catch (error) {
        console.error('Error creating pet:', error);
        res.status(500).json({ error: 'Failed to create pet' });
    }
};