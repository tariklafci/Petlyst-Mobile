const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/ollamaInventoryController');
const authenticateToken = require('../middlewares/authenticateToken');

router.post('/check-reorder',     authenticateToken, ctrl.checkReorder);
router.post('/stock-days',        authenticateToken, ctrl.calculateStockDays);

module.exports = router;
