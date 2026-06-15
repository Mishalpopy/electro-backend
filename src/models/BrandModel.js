const mongoose = require('mongoose');
const Counter = require('./CounterModel');

const brandSchema = new mongoose.Schema({
    id: {
        type: Number,
        unique: true,
    },
    name: {
        type: String,
        required: [true, 'Brand name is required'],
        trim: true,
    },
    image: {
        type: String,
        required: [true, 'Brand image is required'],
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

brandSchema.pre('save', async function () {
    const brand = this;
    if (brand.isNew) {
        const counter = await Counter.findOneAndUpdate(
            { id: 'brand_id' },
            { $inc: { seq: 1 } },
            { returnDocument: 'after', upsert: true }
        );
        brand.id = counter.seq;
    }
});

module.exports = mongoose.model('Brand', brandSchema);
