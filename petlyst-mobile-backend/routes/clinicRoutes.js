const express = require('express');
const router = express.Router();
const { fetchClinics } = require('../controllers/clinicController');

// GET /fetch-clinics
router.get('/fetch-clinics', fetchClinics);

module.exports = router;
