const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/authenticateToken');
const { loginUser, registerUser, resetPassword, verifyResetCode, addExpoToken, refreshToken, deleteExpoTokens } = require('../controllers/authController');

// POST /api/login
router.post('/login', loginUser);

// POST /api/register
router.post('/register', registerUser);

// POST /api/reset-password
router.post('/reset-password', resetPassword);

// POST /api/verify-reset
router.post('/verify-reset', verifyResetCode);

// POST /api/refresh-token
router.post('/refresh-token', authenticateToken, refreshToken);

// PATCH /api/add-expo-token
router.patch('/add-expo-token', authenticateToken, addExpoToken);

// DELETE /api/delete-expo-tokens
router.delete('/delete-expo-tokens', authenticateToken, deleteExpoTokens);

module.exports = router;