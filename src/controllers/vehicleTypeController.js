const VehicleType = require('../models/VehicleTypeModel');
const VehicleModel = require('../models/VehicleModel');

// @desc    Get active vehicle types (optionally filtered by brand)
// @route   GET /api/vehicles/types
// @access  Public
exports.getVehicleTypes = async (req, res) => {
    try {
        const { brand_id } = req.query;
        let types;

        if (brand_id) {
            // Find all unique types used by this brand's models
            const usedTypeIds = await VehicleModel.distinct('type', { brand_id, status: 'active' });
            // Fetch those type objects from VehicleType
            types = await VehicleType.find({ 
                id: { $in: usedTypeIds },
                status: 'active' 
            }).sort({ name: 1 });
        } else {
            types = await VehicleType.find({ status: 'active' }).sort({ name: 1 });
        }

        res.status(200).json({
            success: true,
            message: "Vehicle types fetched successfully",
            data: types
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// @desc    Get all vehicle types (Admin)
// @route   GET /api/vehicles/admin/types
// @access  Private (Admin)
exports.adminGetVehicleTypes = async (req, res) => {
    try {
        const types = await VehicleType.find().sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            data: types
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// @desc    Create a new vehicle type
// @route   POST /api/vehicles/types
// @access  Private (Admin)
exports.createVehicleType = async (req, res) => {
    try {
        const { id, name } = req.body;
        
        const existing = await VehicleType.findOne({ id: id.toLowerCase() });
        if (existing) {
          return res.status(400).json({ success: false, message: 'Type ID already exists' });
        }

        const type = await VehicleType.create({
          id: id.toLowerCase(),
          name,
          status: 'active'
        });

        res.status(201).json({
            success: true,
            data: type
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Failed to create vehicle type',
            error: error.message
        });
    }
};

// @desc    Update a vehicle type
// @route   PUT /api/vehicles/types/:id
// @access  Private (Admin)
exports.updateVehicleType = async (req, res) => {
    try {
        const type = await VehicleType.findOneAndUpdate(
          { id: req.params.id },
          req.body,
          { returnDocument: 'after', runValidators: true }
        );

        if (!type) {
            return res.status(404).json({
                success: false,
                message: 'Vehicle type not found'
            });
        }

        res.status(200).json({
            success: true,
            data: type
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Failed to update type',
            error: error.message
        });
    }
};

// @desc    Delete a vehicle type
// @route   DELETE /api/vehicles/types/:id
// @access  Private (Admin)
exports.deleteVehicleType = async (req, res) => {
    try {
        const type = await VehicleType.findOne({ id: req.params.id });
        if (!type) {
            return res.status(404).json({
                success: false,
                message: 'Vehicle type not found'
            });
        }
        await type.deleteOne();
        res.status(200).json({
            success: true,
            message: 'Vehicle type removed successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};
