const Cart = require('../models/CartModel');
const Product = require('../models/ProductModel');

// @desc    Add item to cart or update quantity if it exists
// @route   POST /api/cart/add
// @access  Private
const addItemToCart = async (req, res) => {
    try {
        const product_id = req.body?.product_id || req.query?.product_id;
        const quantity = req.body?.quantity !== undefined ? req.body.quantity : req.query?.quantity;
        const userId = req.user._id;

        console.log(`Add to cart request: product_id=${product_id}, quantity=${quantity}`);

        // Validation
        if (!product_id || quantity === undefined) {
            return res.status(400).json({ status: false, message: 'product_id and quantity are required' });
        }
        
        if (quantity < 1) {
            return res.status(400).json({ status: false, message: 'Quantity must be at least 1' });
        }

        // Check product existence
        const product = await Product.findOne({ id: product_id });
        if (!product) {
            return res.status(400).json({ status: false, message: 'Invalid product' });
        }

        // Check stock
        if (product.stock_status === 'Out of Stock') {
            return res.status(409).json({ status: false, message: 'Out-of-stock' });
        }

        let cart = await Cart.findOne({ user: userId });

        if (cart) {
            // Check if item already exists
            const itemIndex = cart.items.findIndex(p => p.product.toString() === product._id.toString());

            if (itemIndex > -1) {
                // Update quantity (Add to existing)
                if (product.stock_status === 'Out of Stock') {
                    return res.status(409).json({ status: false, message: 'Out-of-stock for this item' });
                }
                cart.items[itemIndex].quantity += quantity;
            } else {
                // Add new item
                cart.items.push({
                    product: product._id,
                    quantity: quantity,
                    price: product.price
                });
            }
        } else {
            // Create a new cart
            cart = new Cart({
                user: userId,
                items: [{
                    product: product._id,
                    quantity: quantity,
                    price: product.price
                }]
            });
        }

        await cart.save();
        
        // Update product in_cart_count
        await Product.findByIdAndUpdate(product._id, { $inc: { in_cart_count: quantity } });
        
        // Re-fetch cart with populated product details
        const updatedCart = await Cart.findOne({ user: userId }).populate({
            path: 'items.product',
            select: '-_id -__v'
        });

        res.status(200).json({ status: true, message: 'Item added to cart', data: updatedCart });
    } catch (error) {
        console.error('Error in addItemToCart:', error);
        res.status(500).json({ status: false, message: error.message });
    }
};

// @desc    Fetch user cart
// @route   GET /api/cart
// @access  Private
const fetchCartItems = async (req, res) => {
    try {
        const userId = req.user._id;
        let cart = await Cart.findOne({ user: userId }).populate({
            path: 'items.product',
            select: '-_id -__v'
        });

        if (!cart) {
            return res.status(200).json({ status: true, data: { items: [], total_items: 0, total_price: 0 } });
        }

        res.status(200).json({ status: true, data: cart });
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};

// @desc    Update item quantity
// @route   PUT /api/cart/update
// @access  Private
const updateItemQuantity = async (req, res) => {
    try {
        const product_id = req.body?.product_id || req.query?.product_id;
        const quantity = req.body?.quantity !== undefined ? req.body.quantity : req.query?.quantity;
        const userId = req.user._id;

        console.log(`Update cart request: product_id=${product_id}, quantity=${quantity}`);

        if (!product_id || quantity === undefined) {
            return res.status(400).json({ status: false, message: 'product_id and quantity are required' });
        }

        const product = await Product.findOne({ id: product_id });
        if (!product) {
            return res.status(400).json({ status: false, message: 'Invalid product' });
        }

        let cart = await Cart.findOne({ user: userId });
        if (!cart) {
            return res.status(404).json({ status: false, message: 'Cart not found' });
        }

        const itemIndex = cart.items.findIndex(p => p.product.toString() === product._id.toString());

        if (itemIndex > -1) {
            const oldQuantity = cart.items[itemIndex].quantity;
            const delta = quantity - oldQuantity;

            if (quantity > 0) {
                if (product.stock_status === 'Out of Stock') {
                    return res.status(409).json({ status: false, message: 'Out-of-stock' });
                }
                cart.items[itemIndex].quantity = quantity;
            } else {
                cart.items.splice(itemIndex, 1);
            }
            
            await cart.save();

            // Update product in_cart_count
            await Product.findByIdAndUpdate(product._id, { $inc: { in_cart_count: delta } });
        } else {
            return res.status(404).json({ status: false, message: 'Item not in cart' });
        }
        
        // Re-fetch populated cart
        const updatedCart = await Cart.findOne({ user: userId }).populate({
            path: 'items.product',
            select: '-_id -__v'
        });

        res.status(200).json({ status: true, message: 'Cart updated', data: updatedCart });
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};

// @desc    Remove item from cart
// @route   DELETE /api/cart/remove
// @access  Private
const deleteItemFromCart = async (req, res) => {
    try {
        const product_id = req.body?.product_id || req.query?.product_id;
        const userId = req.user._id;

        console.log(`Remove from cart request: product_id=${product_id}`);

        if (!product_id) {
            return res.status(400).json({ status: false, message: 'product_id is required' });
        }

        const product = await Product.findOne({ id: product_id });
        if (!product) {
            return res.status(400).json({ status: false, message: 'Invalid product' });
        }

        let cart = await Cart.findOne({ user: userId });
        if (!cart) {
            return res.status(404).json({ status: false, message: 'Cart not found' });
        }

        const itemIndex = cart.items.findIndex(p => p.product.toString() === product._id.toString());
        const removedQuantity = itemIndex > -1 ? cart.items[itemIndex].quantity : 0;

        if (itemIndex > -1) {
            cart.items.splice(itemIndex, 1);
            await cart.save();
            
            // Update product in_cart_count
            await Product.findByIdAndUpdate(product._id, { $inc: { in_cart_count: -removedQuantity } });

            // Re-fetch populated cart
            const updatedCart = await Cart.findOne({ user: userId }).populate({
                path: 'items.product',
                select: '-_id -__v'
            });

            return res.status(200).json({ status: true, message: 'Item removed', data: updatedCart });
        } else {
            return res.status(404).json({ status: false, message: 'Item not in cart' });
        }
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};

module.exports = {
    addItemToCart,
    fetchCartItems,
    updateItemQuantity,
    deleteItemFromCart
};
