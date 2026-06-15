const express = require('express');
const router = express.Router();
const { addItemToCart, fetchCartItems, updateItemQuantity, deleteItemFromCart } = require('../controllers/cartController');
const { protect } = require('../middleware/authMiddleware');

router.post('/add', protect, addItemToCart);
router.get('/', protect, fetchCartItems);
router.put('/update', protect, updateItemQuantity);
router.delete('/remove', protect, deleteItemFromCart);

module.exports = router;
