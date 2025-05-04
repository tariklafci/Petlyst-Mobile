const express = require('express');
const { createConference } = require('../controllers/jitsiController');
const router = express.Router();

// Prosody will POST form-encoded data here
router.post('/conference', createConference);

module.exports = router;