const VehicleBrand = require('../models/VehicleBrandModel');

// @desc    Get all vehicle brands
// @route   GET /api/vehicles/brands
// @access  Public
exports.getVehicleBrands = async (req, res) => {
    try {
        const brands = await VehicleBrand.find().sort({ createdAt: -1 });
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

// @desc    Get a single vehicle brand
// @route   GET /api/vehicles/brands/:id
// @access  Public
exports.getVehicleBrand = async (req, res) => {
    try {
        const brand = await VehicleBrand.findOne({ id: req.params.id });
        if (!brand) {
            return res.status(404).json({
                success: false,
                message: 'Vehicle Brand not found',
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

// @desc    Create a new vehicle brand
// @route   POST /api/vehicles/brands
// @access  Private (Admin)
exports.createVehicleBrand = async (req, res) => {
    try {
        const brand = await VehicleBrand.create(req.body);
        res.status(201).json({
            success: true,
            data: brand,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Failed to create vehicle brand',
            error: error.message,
        });
    }
};

// @desc    Update a vehicle brand
// @route   PUT /api/vehicles/brands/:id
// @access  Private (Admin)
exports.updateVehicleBrand = async (req, res) => {
    try {
        const { name, image, types, status } = req.body;
        let brand = await VehicleBrand.findOne({ id: req.params.id });
        if (!brand) {
            return res.status(404).json({
                success: false,
                message: 'Vehicle Brand not found',
            });
        }
        brand = await VehicleBrand.findOneAndUpdate({ id: req.params.id }, { name, image, types, status }, {
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
            message: 'Failed to update vehicle brand',
            error: error.message,
        });
    }
};

// @desc    Delete a vehicle brand
// @route   DELETE /api/vehicles/brands/:id
// @access  Private (Admin)
exports.deleteVehicleBrand = async (req, res) => {
    try {
        const brand = await VehicleBrand.findOne({ id: req.params.id });
        if (!brand) {
            return res.status(404).json({
                success: false,
                message: 'Vehicle Brand not found',
            });
        }
        await brand.deleteOne();
        res.status(200).json({
            success: true,
            message: 'Vehicle Brand removed successfully',
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message,
        });
    }
};
