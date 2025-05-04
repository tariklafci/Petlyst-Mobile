const { notifyTodayAppointments, sendTestNotification } = require('../utils/notificationHelper');

/**
 * Test endpoint to trigger today's appointment notifications manually
 */
exports.testSendAppointmentNotifications = async (req, res) => {
  try {
    console.log('Manually triggering appointment notifications test');
    // Add a timeout to prevent hanging requests
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Notification request timed out after 30 seconds')), 30000)
    );
    
    // Race the notification function against a timeout
    await Promise.race([
      notifyTodayAppointments(),
      timeoutPromise
    ]);
    
    res.json({ 
      success: true,
      message: 'Test notifications triggered successfully. Check server logs for details.'
    });
  } catch (error) {
    console.error('Error in test notification endpoint:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to trigger notifications.',
      error: error.message || 'Unknown error'
    });
  }
};

/**
 * Send a test notification to a specific user
 * Requires userId in request body
 */
exports.sendUserTestNotification = async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: userId'
      });
    }
    
    console.log(`Sending test notification to user ID: ${userId}`);
    const result = await sendTestNotification(userId);
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message || 'Test notification sent successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || 'Failed to send test notification'
      });
    }
  } catch (error) {
    console.error('Error sending user test notification:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while sending test notification',
      error: error.message || 'Unknown error'
    });
  }
};
  