const Banner = require('../models/BannerModel');

// @desc    Get all banners
// @route   GET /api/banners
// @access  Public
exports.getBanners = async (req, res) => {
    try {
        const banners = await Banner.find({ isActive: true }).sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            count: banners.length,
            data: banners,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message,
        });
    }
};

// @desc    Get a single banner
// @route   GET /api/banners/:id
// @access  Public
exports.getBanner = async (req, res) => {
    try {
        const banner = await Banner.findOne({ id: req.params.id });
        if (!banner) {
            return res.status(404).json({
                success: false,
                message: 'Banner not found',
            });
        }
        res.status(200).json({
            success: true,
            data: banner,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message,
        });
    }
};

// @desc    Create a new banner
// @route   POST /api/banners
// @access  Private (Admin)
exports.createBanner = async (req, res) => {
    try {
        const banner = await Banner.create(req.body);
        res.status(201).json({
            success: true,
            data: banner,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Failed to create banner',
            error: error.message,
        });
    }
};

// @desc    Update a banner
// @route   PUT /api/banners/:id
// @access  Private (Admin)
exports.updateBanner = async (req, res) => {
    try {
        let banner = await Banner.findOne({ id: req.params.id });
        if (!banner) {
            return res.status(404).json({
                success: false,
                message: 'Banner not found',
            });
        }
        banner = await Banner.findOneAndUpdate({ id: req.params.id }, req.body, {
            returnDocument: 'after',
            runValidators: true,
        });
        res.status(200).json({
            success: true,
            data: banner,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Failed to update banner',
            error: error.message,
        });
    }
};

// @desc    Delete a banner
// @route   DELETE /api/banners/:id
// @access  Private (Admin)
exports.deleteBanner = async (req, res) => {
    try {
        const banner = await Banner.findOne({ id: req.params.id });
        if (!banner) {
            return res.status(404).json({
                success: false,
                message: 'Banner not found',
            });
        }
        await banner.deleteOne();
        res.status(200).json({
            success: true,
            message: 'Banner removed successfully',
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message,
        });
    }
};
