const express = require('express');
const { testSendAppointmentNotifications } = require('../controllers/notificationController');
const router = express.Router();

app.get('/api/test-notifications', testSendAppointmentNotifications);

module.exports = router;



