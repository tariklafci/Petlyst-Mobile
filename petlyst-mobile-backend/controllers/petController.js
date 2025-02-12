const pool = require('../config/db');
const {
    uploadFileToS3,
    deleteFileFromS3,
    generatePresignedUrl,
} = require('../utils/s3Helpers');

// Fetch pets
exports.fetchPets = async (req, res) => {
    try {
        const userId = req.user.sub; // Assuming `req.user.sub` contains the pet owner ID
        const result = await pool.query(
            'SELECT * FROM pets WHERE pet_owner_id = $1',
            [userId]
        );

        const petsWithPresignedUrls = await Promise.all(
            result.rows.map(async (pet) => {
                let signedUrl = null;
                if (pet.pet_photo) {
                    try {
                        signedUrl = await generatePresignedUrl(
                            pet.pet_photo,
                            userId,
                            pet.pet_name // Updated from `pet.name` to `pet.pet_name`
                        );
                    } catch (err) {
                        console.error(
                            `Failed to generate pre-signed URL for pet ID ${pet.pet_id}:`,
                            err
                        );
                    }
                }
                return {
                    ...pet,
                    pet_photo: signedUrl, // Add the signed URL to the response
                };
            })
        );

        res.json(petsWithPresignedUrls);
    } catch (error) {
        console.error('Error fetching pets:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// Add pet
exports.addPet = async (req, res) => {
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

// Delete pet
exports.deletePet = async (req, res) => {
    const { id } = req.body;
    try {
        const pet_owner_id = req.user.sub;

        const petQuery = `SELECT * FROM pets WHERE pet_id = $1 AND pet_owner_id = $2`;
        const petResult = await pool.query(petQuery, [id, pet_owner_id]);

        if (petResult.rowCount === 0) {
            return res
                .status(404)
                .json({ message: 'Pet not found or not owned by user' });
        }

        const pet = petResult.rows[0];
        const { pet_name: petName, pet_photo: petImgUrl } = pet;

        if (petImgUrl) {
            await deleteFileFromS3(pet_owner_id, petName);
            console.log("petImgUrl if'inin içine girdi")
        }

        const deleteQuery = `
      DELETE FROM pets WHERE pet_id = $1 AND pet_owner_id = $2 
      RETURNING *`;
        const deleteResult = await pool.query(deleteQuery, [id, pet_owner_id]);

        res.status(200).json({
            message: 'Pet deleted successfully',
            pet: deleteResult.rows[0],
        });
    } catch (error) {
        console.error('Error deleting pet:', error);
        res.status(500).json({ error: 'Failed to delete pet' });
    }
};