const express = require('express');
const router = express.Router();

const { testSendAppointmentNotifications } = require('../controllers/notificationController');


app.get('/api/test-notifications', testSendAppointmentNotifications);

module.exports = router;



