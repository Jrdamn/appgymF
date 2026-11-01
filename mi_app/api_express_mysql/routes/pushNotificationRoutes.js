const express = require('express');
const router = express.Router();
const pushNotificationController = require('../controllers/pushNotificationController');
const { authenticateToken } = require('../middleware/auth');

router.post('/push-token', authenticateToken, pushNotificationController.registerToken);
router.delete('/push-token', authenticateToken, pushNotificationController.unregisterToken);
router.post('/test', authenticateToken, pushNotificationController.sendTestNotification);

module.exports = router;
