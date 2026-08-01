const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const paymentMethodController = require('../controllers/paymentMethodController');
const { authenticateToken } = require('../middleware/auth');

// Rutas de pagos con PayPal
router.post('/create-paypal-order', authenticateToken, paymentController.createPaypalOrder);
router.post('/capture-paypal-order', authenticateToken, paymentController.capturePaypalOrder);
router.post('/process-card-payment', authenticateToken, paymentController.processCardPayment);

// Rutas de gestión de métodos de pago
router.get('/methods', authenticateToken, paymentMethodController.getMethods);
router.post('/methods', authenticateToken, paymentMethodController.addMethod);
router.delete('/methods/:id', authenticateToken, paymentMethodController.deleteMethod);
router.put('/methods/:id/default', authenticateToken, paymentMethodController.setDefaultMethod);

// Web interface for linking PayPal accounts
router.get('/link-paypal-web', paymentMethodController.renderPaypalLinkPage);
router.post('/link-paypal-web', paymentMethodController.handlePaypalLinkSubmit);

module.exports = router;
