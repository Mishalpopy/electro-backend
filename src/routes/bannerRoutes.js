const express = require('express');
const router = express.Router();
const {
    getBanners,
    getBanner,
    createBanner,
    updateBanner,
    deleteBanner,
} = require('../controllers/bannerController');

// Public routes
router.route('/').get(getBanners);
router.route('/:id').get(getBanner);

// Admin only routes for CRUD
router.route('/').post(createBanner);
router.route('/:id').put(updateBanner).delete(deleteBanner);

module.exports = router;
