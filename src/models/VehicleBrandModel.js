const mongoose = require('mongoose');
const Counter = require('./CounterModel');

const vehicleBrandSchema = new mongoose.Schema({
    id: {
        type: Number,
        unique: true,
    },
    name: {
        type: String,
        required: [true, 'Vehicle Brand name is required'],
        trim: true,
    },
    image: {
        type: String,
        required: [true, 'Vehicle Brand image is required'],
    },
    types: {
        type: [String],
        default: [],
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

vehicleBrandSchema.pre('save', async function () {
    const brand = this;
    if (brand.isNew) {
        const counter = await Counter.findOneAndUpdate(
            { id: 'vehicle_brand_id' },
            { $inc: { seq: 1 } },
            { returnDocument: 'after', upsert: true }
        );
        brand.id = counter.seq;
    }
});

module.exports = mongoose.model('VehicleBrand', vehicleBrandSchema);
