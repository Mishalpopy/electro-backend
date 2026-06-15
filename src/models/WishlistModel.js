const mongoose = require('mongoose');

const WishlistSchema = new mongoose.Schema({
    userId: {
        type: Number,
        ref: 'User',
        required: true
    },
    products: [{
        type: Number,
        ref: 'Product'
    }]
}, { timestamps: true });

module.exports = mongoose.model('Wishlist', WishlistSchema);
