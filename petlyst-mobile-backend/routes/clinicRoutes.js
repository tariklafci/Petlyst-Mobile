const express = require('express');
const router = express.Router();
const { fetchClinics, fetchClinicsAppointment } = require('../controllers/clinicController');
const authenticateToken = require('../middlewares/authenticateToken');


// GET /fetch-clinics
router.get('/fetch-clinics', fetchClinics);
router.get('/fetch-clinic-info-appointments', authenticateToken, fetchClinicsAppointment);

module.exports = router;
