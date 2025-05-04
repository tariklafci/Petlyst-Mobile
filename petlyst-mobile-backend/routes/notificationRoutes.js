const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/authenticateToken');


const { testSendAppointmentNotifications } = require('../controllers/notificationController');


router.get('/test-notifications', authenticateToken, testSendAppointmentNotifications);

module.exports = router;



