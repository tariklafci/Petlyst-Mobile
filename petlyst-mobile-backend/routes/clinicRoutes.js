const express = require('express');
const router = express.Router();
const { fetchClinics, fetchClinicsAppointment, fetchClinicsVeterinarian } = require('../controllers/clinicController');
const authenticateToken = require('../middlewares/authenticateToken');


// GET /fetch-clinics
router.get('/fetch-clinics', fetchClinics);
router.get('/fetch-clinic-info-appointments', authenticateToken, fetchClinicsAppointment);
router.get('/fetch-clinic-veterinarian', fetchClinicsVeterinarian)

module.exports = router;
