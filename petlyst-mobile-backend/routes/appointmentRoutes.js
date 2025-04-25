const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer(); // Or configure as needed
const authenticateToken = require('../middlewares/authenticateToken');
const { createAppointment, fetchAppointments, fetchAppointmentsClinics } = require('../controllers/appointmentController');


router.post('/create-appointment', authenticateToken, createAppointment);
router.get('/fetch-appointments', authenticateToken, fetchAppointments);
router.get('/fetch-appointments-clinics', authenticateToken, fetchAppointmentsClinics);


module.exports = router;
