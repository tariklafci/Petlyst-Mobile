const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/ollamaInventoryController');

router.post('/check-reorder',     ctrl.checkReorder);
router.post('/stock-days',        ctrl.calculateStockDays);
router.post('/avg-weekly-use',    ctrl.averageWeeklyConsumption);
router.post('/slow-moving-items', ctrl.identifySlowMoving);

module.exports = router;
