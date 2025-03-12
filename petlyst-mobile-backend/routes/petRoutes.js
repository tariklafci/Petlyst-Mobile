const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer(); // Or configure as needed
const authenticateToken = require('../middlewares/authenticateToken');
const { fetchPets, addPet, deletePet, editPet } = require('../controllers/petController');

// GET /fetch-pets
router.get('/fetch-pets', authenticateToken, fetchPets);

// POST /add-pet
router.post('/add-pet', authenticateToken, upload.single('photo'), addPet);

// POST /delete-pet
router.post('/delete-pet', authenticateToken, deletePet);

// PATCH /edit-pet
router.patch('/edit-pet', authenticateToken, upload.single('photo'), editPet);

module.exports = router;
