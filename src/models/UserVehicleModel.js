const mongoose = require('mongoose');
const Counter = require('./CounterModel');

const userVehicleSchema = new mongoose.Schema({
    id: {
        type: Number,
        unique: true,
    },
    user_id: {
        type: Number,
        required: [true, 'User ID is required'],
    },
    brand_id: {
        type: Number,
        required: [true, 'Brand ID is required'],
    },
    model_id: {
        type: Number,
        required: [true, 'Model ID is required'],
    },
    vehicle_type: {
        type: String,
        enum: ['car', 'bike', 'motorcycle', 'scooter', 'sedan', 'suv'],
        lowercase: true,
        trim: true,
        required: [true, 'Vehicle type is required'],
    },
    country: {
        type: String,
        required: [true, 'Country is required'],
    },
    emirate: {
        type: String,
        required: [true, 'Emirate is required'],
    },
    plate_code: {
        type: String,
        required: [true, 'Plate code is required'],
    },
    plate_number: {
        type: String,
        required: [true, 'Plate number is required'],
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

userVehicleSchema.pre('save', async function () {
    const userVehicle = this;
    if (userVehicle.isNew) {
        const counter = await Counter.findOneAndUpdate(
            { id: 'user_vehicle_id' },
            { $inc: { seq: 1 } },
            { returnDocument: 'after', upsert: true }
        );
        userVehicle.id = counter.seq;
    }
});

module.exports = mongoose.model('UserVehicle', userVehicleSchema);
