const express = require('express');
const router = express.Router();
const pushNotificationController = require('../controllers/pushNotificationController');
const { authenticateToken } = require('../middleware/auth');

router.post('/push-token', authenticateToken, pushNotificationController.registerToken);
router.delete('/push-token', authenticateToken, pushNotificationController.unregisterToken);
router.post('/web-subscription', authenticateToken, pushNotificationController.registerWebSubscription);
router.delete('/web-subscription', authenticateToken, pushNotificationController.unregisterWebSubscription);
router.post('/test', authenticateToken, pushNotificationController.sendTestNotification);

module.exports = router;
