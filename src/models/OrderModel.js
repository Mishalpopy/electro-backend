const mongoose = require('mongoose');
const Counter = require('./CounterModel');

const orderItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    price: {
        type: Number,
        required: true
    }
});

const orderSchema = new mongoose.Schema({
    id: { type: Number, unique: true },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    address: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Address',
        required: true
    },
    items: [orderItemSchema],
    totalItems: {
        type: Number,
        required: true,
        default: 0
    },
    itemsPrice: {
        type: Number,
        required: true,
        default: 0.0
    },
    deliveryFee: {
        type: Number,
        required: true,
        default: 0.0
    },
    totalPrice: {
        type: Number,
        required: true,
        default: 0.0
    },
    paymentMethod: {
        type: String,
        required: true,
        enum: ['Cash on Delivery', 'Credit / Debit Card']
    },
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Paid', 'Failed', 'Refunded'],
        default: 'Pending'
    },
    paymentId: {
        type: String
    },
    paidAt: {
        type: Date
    },
    status: {
        type: String,
        required: true,
        enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
        default: 'Pending'
    }
}, {
    timestamps: true
});

// Pre-save hook to auto-increment the 'id' field
orderSchema.pre('save', async function() {
    if (this.isNew) {
        const Counter = mongoose.model('Counter');
        const counter = await Counter.findOneAndUpdate(
            { id: 'orderId' },
            { $inc: { seq: 1 } },
            { returnDocument: 'after', upsert: true }
        );
        this.id = counter.seq;
    }
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
