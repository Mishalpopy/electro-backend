const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
        default: 1,
        min: [1, 'Quantity cannot be less than 1.'],
    },
    price: {
        type: Number,
        required: true,
    }
}, { _id: false });

const cartSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
    },
    items: [cartItemSchema],
    total_items: {
        type: Number,
        required: true,
        default: 0,
    },
    total_price: {
        type: Number,
        required: true,
        default: 0,
    }
}, { timestamps: true });

cartSchema.pre('save', async function () {
    this.total_items = this.items.reduce((total, item) => total + item.quantity, 0);
    this.total_price = this.items.reduce((total, item) => total + (item.price * item.quantity), 0);
    
    this.total_price = Number(this.total_price.toFixed(2));
});

module.exports = mongoose.model('Cart', cartSchema);
