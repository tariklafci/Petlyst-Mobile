const express = require('express');
const router = express.Router();
const { fetchClinics, fetchClinicsAppointment } = require('../controllers/clinicController');

// GET /fetch-clinics
router.get('/fetch-clinics', fetchClinics);
router.get('/fetch-clinics-info-appointments', fetchClinicsAppointment);


module.exports = router;
