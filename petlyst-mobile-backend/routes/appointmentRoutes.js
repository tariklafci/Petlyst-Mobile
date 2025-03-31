const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const { authenticateToken } = require('../middleware/auth');

// Create a new appointment
router.post('/create-appointment', authenticateToken, appointmentController.createAppointment);

// Get all appointments for a user
router.get('/fetch-appointments', authenticateToken, appointmentController.fetchAppointments);

// Get appointment details by ID
router.get('/appointment/:id', authenticateToken, appointmentController.getAppointmentById);

// Cancel/delete an appointment
router.post('/cancel-appointment', authenticateToken, appointmentController.cancelAppointment);

module.exports = router;
