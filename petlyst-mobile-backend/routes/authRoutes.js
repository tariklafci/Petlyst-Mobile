const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/authenticateToken');
const { loginUser, registerUser, resetPassword, verifyResetCode, addExpoToken } = require('../controllers/authController');

// POST /api/login
router.post('/login', loginUser);

// POST /api/register
router.post('/register', registerUser);

// POST /api/reset-password
router.post('/reset-password', resetPassword);

// POST /api/verify-reset
router.post('/verify-reset', verifyResetCode);

// PATCH /api/add-expo-token
router.patch('/add-expo-token', authenticateToken, editPet);

module.exports = router;