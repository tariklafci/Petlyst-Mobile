const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/inventoryController');
const authenticateToken = require('../middleware/authenticateToken');

router.post('/check-reorder',     authenticateToken, ctrl.checkReorder);
router.post('/stock-days',        authenticateToken, ctrl.calculateStockDays);
router.post('/avg-weekly-use',    authenticateToken, ctrl.averageWeeklyConsumption);
router.post('/slow-moving-items', authenticateToken, ctrl.identifySlowMoving);

module.exports = router;
