const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer(); // Or configure as needed
const authenticateToken = require('../middlewares/authenticateToken');
const { createAppointment, fetchAppointments, fetchAppointmentsClinic, cancelPendingAppointment, updateAppointmentStatus } = require('../controllers/appointmentController');


router.post('/create-appointment', authenticateToken, createAppointment);
router.get('/fetch-appointments', authenticateToken, fetchAppointments);
router.get('/fetch-appointments-clinics', authenticateToken, fetchAppointmentsClinic);
router.patch('/cancel-pending-appointment', authenticateToken, cancelPendingAppointment);
router.patch('/update-appointment-status', authenticateToken, updateAppointmentStatus);


module.exports = router;
