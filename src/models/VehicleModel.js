const mongoose = require('mongoose');
const Counter = require('./CounterModel');

const vehicleModelSchema = new mongoose.Schema({
    id: {
        type: Number,
        unique: true,
    },
    brand_id: {
        type: Number,
        required: [true, 'Brand ID is required'],
    },
    name: {
        type: String,
        required: [true, 'Model name is required'],
        trim: true,
    },
    type: {
        type: String,
        required: [true, 'Vehicle type is required'],
        trim: true,
    },
    category: {
        type: String,
        trim: true,
        lowercase: true,
        default: '',
    },
    image: {
        type: String,
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

// Index for performance
vehicleModelSchema.index({ brand_id: 1, type: 1, category: 1 });

vehicleModelSchema.pre('save', async function () {
    const model = this;
    if (model.isNew) {
        const counter = await Counter.findOneAndUpdate(
            { id: 'vehicle_model_id' },
            { $inc: { seq: 1 } },
            { returnDocument: 'after', upsert: true }
        );
        model.id = counter.seq;
    }
});

module.exports = mongoose.model('VehicleModel', vehicleModelSchema);
