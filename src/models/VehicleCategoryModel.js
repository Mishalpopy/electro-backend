const mongoose = require('mongoose');

const vehicleCategorySchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
    },
    name: {
        type: String,
        required: [true, 'Vehicle category name is required'],
        trim: true,
    },
    vehicle_type: {
        type: String,
        required: [true, 'Vehicle type is required'],
        trim: true,
        lowercase: true,
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

vehicleCategorySchema.index({ vehicle_type: 1, status: 1 });

module.exports = mongoose.model('VehicleCategory', vehicleCategorySchema);
