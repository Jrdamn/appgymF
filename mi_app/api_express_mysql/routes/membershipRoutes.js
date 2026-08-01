const express = require('express');
const router = express.Router();
const membershipController = require('../controllers/membershipController');
const { authenticateToken, isAdmin } = require('../middleware/auth');

router.get('/', authenticateToken, membershipController.getAllMemberships);
router.post('/', authenticateToken, isAdmin, membershipController.createMembership);

module.exports = router;
