const express = require('express');
const { generateResponse } = require('../controllers/ollamaController');
const router = express.Router();

router.post('/generate-response', authenticateToken, generateResponse);

module.exports = router;



