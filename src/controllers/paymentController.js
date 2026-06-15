const crypto = require('crypto');
const Cart = require('../models/CartModel');
const Address = require('../models/AddressModel');
const Order = require('../models/OrderModel');

// @desc    Create Paymob Payment Intention
// @route   POST /api/payment/create-payment-intent
// @access  Private
exports.createPaymentIntent = async (req, res) => {
    try {
        const { deliveryFee, currency, addressId } = req.body;

        if (!addressId) {
            return res.status(400).json({ status: false, message: 'addressId is required' });
        }

        const address = await Address.findOne({ id: addressId, user: req.user._id });
        if (!address) {
            return res.status(404).json({ status: false, message: 'Address not found' });
        }

        const cart = await Cart.findOne({ user: req.user._id });
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ status: false, message: 'Cart is empty.' });
        }

        const itemsPrice = cart.total_price;
        const totalAmount = itemsPrice + (deliveryFee || 0);
        const amountCents = Math.round(totalAmount * 100);

        // Split name safely
        const nameParts = (req.user.name || 'John Doe').split(' ');
        const firstName = nameParts[0] || 'John';
        const lastName = nameParts.slice(1).join(' ') || 'Doe';

        // Prepare Paymob Intention Request payload
        const payload = {
            amount: amountCents,
            currency: currency || 'AED',
            payment_methods: [ parseInt(process.env.PAYMOB_INTEGRATION_ID) ],
            billing_data: {
                first_name: firstName,
                last_name: lastName,
                email: req.user.email || 'user@example.com',
                phone_number: req.user.phone || '+971500000000',
                apartment: 'NA',
                floor: 'NA',
                street: address.address_line_1 || 'NA',
                building: address.address_line_2 || 'NA',
                postal_code: address.pincode || 'NA',
                city: address.city || 'NA',
                country: 'UAE',
                state: address.state || 'NA'
            },
            extras: {
                userId: req.user._id.toString(),
                cartId: cart._id.toString()
            }
        };

        const response = await fetch(process.env.PAYMOB_INTENTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Token ${process.env.PAYMOB_SECRET_KEY}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Paymob Intention Error Response:', data);
            return res.status(response.status).json({
                status: false,
                message: 'Failed to create payment intention with Paymob',
                error: data
            });
        }

        res.status(200).json({
            status: true,
            message: 'Paymob payment details created successfully',
            data: {
                paymentKey: data.client_secret,
                paymobOrderId: data.id, // The Intention ID
                checkoutUrl: data.checkout_url || `https://uae.paymob.com/unifiedcheckout/?api_key=${process.env.PAYMOB_PUBLIC_KEY}&client_secret=${data.client_secret}`,
                amount: totalAmount,
                currency: currency || 'AED'
            }
        });

    } catch (error) {
        console.error('Create Paymob Payment Intention Error:', error);
        res.status(500).json({ status: false, message: error.message });
    }
};

// @desc    Paymob Webhook Transaction Callback
// @route   POST /api/payment/webhook
// @access  Public
exports.stripeWebhook = async (req, res) => {
    try {
        const hmacSent = req.query.hmac;
        const transactionData = req.body.obj;

        if (!transactionData) {
            return res.status(400).json({ success: false, message: 'Invalid payload' });
        }

        // HMAC verification
        const hmacSecret = process.env.PAYMOB_HMAC_SECRET;
        if (hmacSecret && hmacSent) {
            const {
                amount_cents,
                created_at,
                currency,
                error_occured,
                has_parent_transaction,
                id,
                integration_id,
                is_3d_secure,
                is_auth,
                is_capture,
                is_voided,
                is_refunded,
                owner,
                pending,
                source_data,
                success
            } = transactionData;

            const pan = source_data?.pan || '';
            const sub_type = source_data?.sub_type || '';
            const type = source_data?.type || '';

            const concatenatedString = 
                amount_cents +
                created_at +
                currency +
                error_occured +
                has_parent_transaction +
                id +
                integration_id +
                is_3d_secure +
                is_auth +
                is_capture +
                is_voided +
                is_refunded +
                owner +
                pending +
                pan +
                sub_type +
                type +
                success;

            const calculatedHmac = crypto
                .createHmac('sha512', hmacSecret)
                .update(concatenatedString)
                .digest('hex');

            if (calculatedHmac !== hmacSent) {
                console.error('Paymob HMAC verification failed.');
                return res.status(401).json({ success: false, message: 'HMAC verification failed' });
            }
        }

        const paymobOrderId = transactionData.order?.id || transactionData.order;
        const transactionSuccess = transactionData.success === true || transactionData.success === 'true';

        console.log(`Paymob callback received. Order ID/Ref: ${paymobOrderId}, Success: ${transactionSuccess}`);

        // Update corresponding order status in DB
        if (paymobOrderId) {
            // Find order by paymentId (could store transaction id or order id)
            const order = await Order.findOne({ paymentId: paymobOrderId.toString() });
            if (order) {
                if (transactionSuccess) {
                    order.paymentStatus = 'Paid';
                    order.status = 'Processing';
                    order.paidAt = new Date();
                } else {
                    order.paymentStatus = 'Failed';
                }
                await order.save();
                console.log(`Order ${order.id} paymentStatus updated to ${order.paymentStatus}`);
            }
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Paymob Webhook Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
