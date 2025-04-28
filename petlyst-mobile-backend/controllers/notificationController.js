const { notifyTodayAppointments } = require('../utils/notificationHelper');

exports.testSendAppointmentNotifications = async (req, res) => {
  try {
    await notifyTodayAppointments();
    res.json({ message: 'Test notifications triggered successfully.' });
  } catch (error) {
    console.error('Error in test notification endpoint:', error.message);
    res.status(500).json({ message: 'Failed to trigger notifications.', error: error.message });
  }
};
  