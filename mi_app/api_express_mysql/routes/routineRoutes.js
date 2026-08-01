const express = require('express');
const router = express.Router();
const routineController = require('../controllers/routineController');
const { authenticateToken, isAdmin, isCoachOrAdmin } = require('../middleware/auth');

// Rutas de rutinas de ejercicio
router.get('/my-routines', authenticateToken, routineController.getMyRoutines);
router.get('/user/:userId', authenticateToken, isCoachOrAdmin, routineController.getUserRoutines);
router.post('/', authenticateToken, isCoachOrAdmin, routineController.createRoutine);
router.delete('/:id', authenticateToken, isCoachOrAdmin, routineController.deleteRoutine);

module.exports = router;
