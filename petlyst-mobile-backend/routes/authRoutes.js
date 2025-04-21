const express = require('express');
const router = express.Router();
const { loginUser, registerUser, resetPassword, verifyResetCode } = require('../controllers/authController');

// POST /api/login
router.post('/login', loginUser);

// POST /api/register
router.post('/register', registerUser);

// POST /api/reset-password
router.post('/reset-password', resetPassword);

// POST /api/verify-reset
router.post('/verify-reset', verifyResetCode);

module.exports = router;