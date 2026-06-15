const mongoose = require('mongoose');
const Counter = require('./CounterModel');

const productSchema = new mongoose.Schema({
    id: {
        type: Number,
        unique: true,
    },
    brand: {
        type: String,
        default: 'Unknown',
        trim: true,
    },
    name: {
        type: String,
        default: 'Unnamed Product',
        trim: true,
    },
    description: {
        type: String,
        default: 'No description provided',
    },
    price: {
        type: Number,
        default: 0,
    },
    image: {
        type: String, // main/thumbnail image
        default: 'https://placehold.co/400x400',
    },
    images: {
        type: [String], // array of image urls
        default: [],
    },
    warranty: {
        type: String,
        default: 'Not specified',
    },
    capacity: {
        type: String,
        default: 'Not specified',
    },
    voltage: {
        type: String,
        default: 'Not specified',
    },
    battery_type: {
        type: String,
        default: 'Not specified',
    },
    ah: {
        type: String,
        default: 'Not specified',
    },
    cca: {
        type: String,
        default: 'Not specified',
    },
    dimensions: {
        type: String,
        default: 'Not specified',
    },
    part_number: {
        type: String,
        default: 'Not specified',
    },
    stock_status: {
        type: String,
        default: 'In Stock',
        enum: ['In Stock', 'Out of Stock'],
    },
    is_favorite: {
        type: Boolean,
        default: false,
    },
    in_cart_count: {
        type: Number,
        default: 0,
    },
    type: {
        type: String,
        default: 'battery',
        trim: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

productSchema.pre('save', async function () {
    const product = this;
    if (product.isNew) {
        const counter = await Counter.findOneAndUpdate(
            { id: 'product_id' },
            { $inc: { seq: 1 } },
            { returnDocument: 'after', upsert: true }
        );
        product.id = counter.seq;
    }
});

module.exports = mongoose.model('Product', productSchema);
