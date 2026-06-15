// src/controllers/orderController.js
const Order = require('../models/OrderModel');
const Cart = require('../models/CartModel');
const Address = require('../models/AddressModel');

exports.placeOrder = async (req, res) => {
    try {
        const { addressId, paymentMethod, deliveryFee, paymentId } = req.body;
        
        if (!addressId || !paymentMethod) {
            return res.status(400).json({ status: false, message: 'Address and Payment Method are required.' });
        }

        const address = await Address.findOne({ id: addressId, user: req.user._id });
        if (!address) {
            return res.status(404).json({ status: false, message: 'Address not found.' });
        }

        const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ status: false, message: 'Cart is empty.' });
        }

        const orderItems = cart.items.map(item => ({
            product: item.product._id,
            quantity: item.quantity,
            price: item.price
        }));

        const itemsPrice = cart.total_price;
        const totalAmount = itemsPrice + (deliveryFee || 0);

        let paymentStatus = 'Pending';
        let paidAt = null;

        if (paymentMethod === 'Credit / Debit Card') {
            if (!paymentId) {
                return res.status(400).json({ status: false, message: 'Payment ID (Paymob Intention ID) is required for Credit / Debit Card payments.' });
            }
            try {
                // Verify the payment intent status with Paymob
                const url = `${process.env.PAYMOB_INTENTION_URL}${paymentId}`;
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Token ${process.env.PAYMOB_SECRET_KEY}`
                    }
                });
                const data = await response.json();
                
                console.log('Paymob Intention Verification Response:', data);

                if (!response.ok) {
                    return res.status(400).json({ status: false, message: `Paymob verification error: ${data.message || 'Intention not found'}` });
                }

                // If payment was completed, the intention status is usually "paid" or "completed" or check is_completed
                const isPaid = data.payment_status === 'paid' || data.status === 'paid' || data.is_completed === true;

                if (!isPaid) {
                    return res.status(400).json({ status: false, message: `Paymob payment is not completed. Status: ${data.payment_status || data.status}` });
                }
                paymentStatus = 'Paid';
                paidAt = new Date();
            } catch (err) {
                return res.status(400).json({ status: false, message: `Paymob payment verification failed: ${err.message}` });
            }
        }

        const newOrder = new Order({
            user: req.user._id,
            address: address._id, // Storing ObjectId of address
            items: orderItems,
            totalItems: cart.total_items,
            itemsPrice: itemsPrice,
            deliveryFee: deliveryFee || 0,
            totalPrice: totalAmount,
            paymentMethod: paymentMethod,
            paymentStatus: paymentStatus,
            paymentId: paymentId || null,
            paidAt: paidAt,
            status: paymentStatus === 'Paid' ? 'Processing' : 'Pending'
        });

        await newOrder.save();

        // Clear cart after placing order
        cart.items = [];
        cart.total_items = 0;
        cart.total_price = 0;
        await cart.save();

        res.status(201).json({
            status: true,
            message: 'Order placed successfully',
            data: newOrder
        });

    } catch (error) {
        console.error('Place Order Error:', error);
        res.status(500).json({ status: false, message: 'Server Error' });
    }
};

exports.getOrders = async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user._id }).populate('items.product');
        res.status(200).json({ status: true, data: orders });
    } catch (error) {
        console.error('Get Orders Error:', error);
        res.status(500).json({ status: false, message: 'Server Error' });
    }
};

exports.getAllOrdersAdmin = async (req, res) => {
    try {
        const orders = await Order.find().populate('user').populate('items.product').populate('address');
        res.status(200).json({ status: true, data: orders });
    } catch (error) {
        console.error('Get All Orders Admin Error:', error);
        res.status(500).json({ status: false, message: 'Server Error' });
    }
};

exports.updateOrderStatusAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const order = await Order.findById(id);
        if (!order) {
            return res.status(404).json({ status: false, message: 'Order not found.' });
        }

        order.status = status;
        await order.save();

        res.status(200).json({ status: true, message: 'Order status updated successfully', data: order });
    } catch (error) {
        console.error('Update Order Status Error:', error);
        res.status(500).json({ status: false, message: 'Server Error' });
    }
};
