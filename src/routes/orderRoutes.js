const express = require('express');
const router = express.Router();
const { placeOrder, getOrders, getAllOrdersAdmin, updateOrderStatusAdmin } = require('../controllers/orderController');
const { protect, admin } = require('../middleware/authMiddleware');

router.post('/place', protect, placeOrder);
router.get('/', protect, getOrders);
router.get('/admin/all', protect, admin, getAllOrdersAdmin);
router.put('/admin/status/:id', protect, admin, updateOrderStatusAdmin);

module.exports = router;
