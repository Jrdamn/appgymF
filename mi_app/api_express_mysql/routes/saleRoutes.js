const express = require('express');
const router = express.Router();
const saleController = require('../controllers/saleController');
const { authenticateToken, isAdmin } = require('../middleware/auth');

router.get('/', authenticateToken, isAdmin, saleController.getAllSales);
router.get('/stats', authenticateToken, isAdmin, saleController.getStats);
router.get('/today', authenticateToken, isAdmin, saleController.getTodaySales);
router.get('/report/pdf', authenticateToken, isAdmin, saleController.getReportPDF);
router.post('/', authenticateToken, isAdmin, saleController.createSale);
router.get('/:id/pdf', authenticateToken, saleController.getSalePDF);

module.exports = router;
