const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/authenticateToken');

const { 
  testSendAppointmentNotifications,
  sendUserTestNotification 
} = require('../controllers/notificationController');

// Test route for triggering today's appointment notifications
router.get('/test-notifications', authenticateToken, testSendAppointmentNotifications);

// Test route for sending a notification to a specific user
router.post('/test-user-notification', authenticateToken, sendUserTestNotification);

module.exports = router;1



