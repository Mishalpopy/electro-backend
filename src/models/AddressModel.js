const mongoose = require('mongoose');
const Counter = require('./CounterModel');

const addressSchema = new mongoose.Schema({
    id: {
        type: Number,
        unique: true,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    address_type: {
        type: String,
        required: [true, 'Address type is required'],
        enum: ['home', 'office', 'other'],
        default: 'home',
    },
    full_name: {
        type: String,
        required: [true, 'Full name is required'],
        trim: true,
    },
    phone_number: {
        type: String,
        required: [true, 'Phone number is required'],
        match: [/^\d{10,15}$/, 'Please add a valid phone number'],
    },
    address_line_1: {
        type: String,
        required: [true, 'Address line 1 is required'],
        trim: true,
    },
    address_line_2: {
        type: String,
        trim: true,
    },
    city: {
        type: String,
        required: [true, 'City is required'],
        trim: true,
    },
    pincode: {
        type: String,
        required: [true, 'Pincode is required'],
        trim: true,
    },
    is_default: {
        type: Boolean,
        default: false,
    }
}, {
    timestamps: true
});

// Auto-increment Address ID using Counter model
addressSchema.pre('save', async function () {
    const address = this;

    if (address.isNew) {
        const counter = await Counter.findOneAndUpdate(
            { id: 'address_id' },
            { $inc: { seq: 1 } },
            { returnDocument: 'after', upsert: true }
        );
        address.id = counter.seq;
    }
});

module.exports = mongoose.model('Address', addressSchema);
