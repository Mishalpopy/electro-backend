const VehicleCategory = require('../models/VehicleCategoryModel');

const toSlug = (value = '') =>
    value
        .toString()
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-');

// @desc    Get active categories (optionally filtered by vehicle type)
// @route   GET /api/vehicles/categories
// @access  Public
exports.getVehicleCategories = async (req, res) => {
    try {
        const { vehicle_type } = req.query;
        const query = { status: 'active' };
        if (vehicle_type) {
            query.vehicle_type = vehicle_type.toString().trim().toLowerCase();
        }

        const categories = await VehicleCategory.find(query).sort({ name: 1 });
        res.status(200).json({
            success: true,
            message: 'Vehicle categories fetched successfully',
            data: categories,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message,
        });
    }
};

// @desc    Get all categories for admin
// @route   GET /api/vehicles/admin/categories
// @access  Private (Admin)
exports.adminGetVehicleCategories = async (req, res) => {
    try {
        const categories = await VehicleCategory.find().sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            data: categories,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message,
        });
    }
};

// @desc    Create category
// @route   POST /api/vehicles/categories
// @access  Private (Admin)
exports.createVehicleCategory = async (req, res) => {
    try {
        const { id, name, vehicle_type } = req.body;
        const normalizedId = toSlug(id || name);
        const normalizedType = vehicle_type?.toString().trim().toLowerCase();

        if (!normalizedId || !name || !normalizedType) {
            return res.status(400).json({
                success: false,
                message: 'Category id/name and vehicle_type are required',
            });
        }

        const existing = await VehicleCategory.findOne({ id: normalizedId });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'Category ID already exists',
            });
        }

        const category = await VehicleCategory.create({
            id: normalizedId,
            name,
            vehicle_type: normalizedType,
            status: req.body.status || 'active',
        });

        res.status(201).json({
            success: true,
            data: category,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Failed to create vehicle category',
            error: error.message,
        });
    }
};

// @desc    Update category
// @route   PUT /api/vehicles/categories/:id
// @access  Private (Admin)
exports.updateVehicleCategory = async (req, res) => {
    try {
        const payload = { ...req.body };
        if (payload.vehicle_type) {
            payload.vehicle_type = payload.vehicle_type.toString().trim().toLowerCase();
        }

        const category = await VehicleCategory.findOneAndUpdate(
            { id: req.params.id },
            payload,
            { returnDocument: 'after', runValidators: true }
        );

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Vehicle category not found',
            });
        }

        res.status(200).json({
            success: true,
            data: category,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Failed to update vehicle category',
            error: error.message,
        });
    }
};

// @desc    Delete category
// @route   DELETE /api/vehicles/categories/:id
// @access  Private (Admin)
exports.deleteVehicleCategory = async (req, res) => {
    try {
        const category = await VehicleCategory.findOne({ id: req.params.id });
        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Vehicle category not found',
            });
        }

        await category.deleteOne();
        res.status(200).json({
            success: true,
            message: 'Vehicle category removed successfully',
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message,
        });
    }
};
