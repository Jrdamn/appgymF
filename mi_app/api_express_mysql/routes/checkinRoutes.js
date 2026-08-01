const express = require('express');
const router = express.Router();
const checkinController = require('../controllers/checkinController');
const { authenticateToken, isAdmin, isCoachOrAdmin } = require('../middleware/auth');

router.get('/web-scan', checkinController.webScanRegister);
router.get('/today', authenticateToken, isCoachOrAdmin, checkinController.getTodayCheckins);
router.get('/history/:userId', authenticateToken, checkinController.getUserCheckinHistory);
router.post('/', authenticateToken, isCoachOrAdmin, checkinController.registerCheckin);
router.put('/:id/checkout', authenticateToken, isCoachOrAdmin, checkinController.manuallyCheckoutCheckin);
router.delete('/:id', authenticateToken, isCoachOrAdmin, checkinController.deleteCheckin);

module.exports = router;
