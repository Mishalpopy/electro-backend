const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleController');

// User Vehicle routes
router.get('/vehicles', vehicleController.getUserVehicles);
router.post('/vehicles', vehicleController.addUserVehicle);
router.delete('/vehicles/:id', vehicleController.removeUserVehicle);

module.exports = router;
