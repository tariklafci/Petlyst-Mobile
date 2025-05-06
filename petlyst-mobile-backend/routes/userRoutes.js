const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authenticateToken = require('../middlewares/authenticateToken');

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Get user profile
router.get('/profile', userController.getUserProfile);

// Update user profile
router.put('/update-profile', userController.updateProfile);

// Update profile photo
router.put('/update-photo', userController.updateProfilePhoto);

module.exports = router; 