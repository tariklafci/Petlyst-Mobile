const express = require('express');
const router = express.Router();
const { fetchClinics, fetchClinicsAppointment, fetchClinicsVeterinarian, fetchClinicCoordinates } = require('../controllers/clinicController');
const authenticateToken = require('../middlewares/authenticateToken');


// GET /fetch-clinics
router.get('/fetch-clinics', authenticateToken, fetchClinics);
router.get('/fetch-clinic-info-appointments', authenticateToken, fetchClinicsAppointment);
router.get('/fetch-clinic-veterinarian', authenticateToken, fetchClinicsVeterinarian);
router.get('/fetch-clinic-coordinates', authenticateToken, fetchClinicCoordinates);

module.exports = router;
