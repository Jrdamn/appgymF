const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticateToken, isAdmin } = require('../middleware/auth');

router.get('/', authenticateToken, productController.getAllProducts);
router.post('/', authenticateToken, isAdmin, productController.createProduct);
router.put('/:id', authenticateToken, isAdmin, productController.updateProduct);
router.delete('/:id', authenticateToken, isAdmin, productController.deleteProduct);

module.exports = router;
