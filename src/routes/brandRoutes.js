const express = require('express');
const router = express.Router();
const {
    getBrands,
    getBrand,
    createBrand,
    updateBrand,
    deleteBrand,
    getBrandCapacities,
} = require('../controllers/brandController');

// Public routes
router.route('/').get(getBrands);
router.route('/:id').get(getBrand);
router.route('/:name/capacities').get(getBrandCapacities);

// Admin only routes for CRUD (add admin middleware if needed)
router.route('/').post(createBrand);
router.route('/:id').put(updateBrand).delete(deleteBrand);

module.exports = router;
