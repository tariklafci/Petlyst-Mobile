exports.testSendAppointmentNotifications = async (req, res) => {
    try {
      await notifyTodayAppointments(); // This is the same function your cron calls!
      res.json({ message: 'Test notifications sent.' });
    } catch (error) {
      console.error('Error in test notification endpoint:', error);
      res.status(500).json({ message: 'Failed to send test notifications.' });
    }
  };
  