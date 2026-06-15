const Wishlist = require('../models/WishlistModel');
const Product = require('../models/ProductModel');

// @desc    Get user wishlist
// @route   GET /api/wishlist
// @access  Private
const getWishlist = async (req, res) => {
    try {
        let wishlist = await Wishlist.findOne({ userId: req.user.id });
        
        if (!wishlist) {
            wishlist = await Wishlist.create({ userId: req.user.id, products: [] });
        }

        // Fetch product details for each ID in wishlist
        const products = await Product.find({ id: { $in: wishlist.products } }).select('-__v -_id');

        res.status(200).json({ status: true, data: products });
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};

// @desc    Toggle product in wishlist (Add/Remove)
// @route   POST /api/wishlist/toggle
// @access  Private
const toggleWishlist = async (req, res) => {
    try {
        const { product_id } = req.body;
        if (!product_id) {
            return res.status(400).json({ status: false, message: 'product_id is required' });
        }

        let wishlist = await Wishlist.findOne({ userId: req.user.id });
        
        if (!wishlist) {
            wishlist = await Wishlist.create({ userId: req.user.id, products: [] });
        }

        const productIndex = wishlist.products.indexOf(product_id);
        let action = '';

        if (productIndex > -1) {
            // Remove
            wishlist.products.splice(productIndex, 1);
            action = 'removed';
        } else {
            // Add
            wishlist.products.push(product_id);
            action = 'added';
        }

        await wishlist.save();
        res.status(200).json({ 
            status: true, 
            message: `Product ${action} successfully`, 
            is_favorite: action === 'added' 
        });
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};

module.exports = {
    getWishlist,
    toggleWishlist
};
