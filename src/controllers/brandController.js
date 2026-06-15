const Brand = require('../models/BrandModel');
const Product = require('../models/ProductModel');

// @desc    Get all brands
// @route   GET /api/brands
// @access  Public
exports.getBrands = async (req, res) => {
    try {
        const brands = await Brand.find().sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            count: brands.length,
            data: brands,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message,
        });
    }
};

// @desc    Get a single brand
// @route   GET /api/brands/:id
// @access  Public
exports.getBrand = async (req, res) => {
    try {
        const brand = await Brand.findOne({ id: req.params.id });
        if (!brand) {
            return res.status(404).json({
                success: false,
                message: 'Brand not found',
            });
        }
        res.status(200).json({
            success: true,
            data: brand,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message,
        });
    }
};

// @desc    Create a new brand
// @route   POST /api/brands
// @access  Private (Admin)
exports.createBrand = async (req, res) => {
    try {
        const brand = await Brand.create(req.body);
        res.status(201).json({
            success: true,
            data: brand,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Failed to create brand',
            error: error.message,
        });
    }
};

// @desc    Update a brand
// @route   PUT /api/brands/:id
// @access  Private (Admin)
exports.updateBrand = async (req, res) => {
    try {
        let brand = await Brand.findOne({ id: req.params.id });
        if (!brand) {
            return res.status(404).json({
                success: false,
                message: 'Brand not found',
            });
        }
        brand = await Brand.findOneAndUpdate({ id: req.params.id }, req.body, {
            returnDocument: 'after',
            runValidators: true,
        });
        res.status(200).json({
            success: true,
            data: brand,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Failed to update brand',
            error: error.message,
        });
    }
};

// @desc    Delete a brand
// @route   DELETE /api/brands/:id
// @access  Private (Admin)
exports.deleteBrand = async (req, res) => {
    try {
        const brand = await Brand.findOne({ id: req.params.id });
        if (!brand) {
            return res.status(404).json({
                success: false,
                message: 'Brand not found',
            });
        }
        await brand.deleteOne();
        res.status(200).json({
            success: true,
            message: 'Brand removed successfully',
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message,
        });
    }
};

// @desc    Get unique capacities for a brand
// @route   GET /api/brands/:name/capacities
// @access  Public
exports.getBrandCapacities = async (req, res) => {
    try {
        const capacities = await Product.distinct('capacity', {
            brand: { $regex: new RegExp(`^${req.params.name}$`, 'i') },
        });

        // Filter and sort the capacities (e.g., Ah values)
        const sortedCapacities = capacities
            .filter(c => c && c !== 'Not specified')
            .sort((a, b) => {
                const valA = parseInt(a.match(/\d+/) || 0);
                const valB = parseInt(b.match(/\d+/) || 0);
                return valA - valB;
            });

        res.status(200).json({
            success: true,
            data: sortedCapacities,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message,
        });
    }
};
