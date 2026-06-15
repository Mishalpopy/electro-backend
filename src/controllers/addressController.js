const Address = require('../models/AddressModel');

// @desc    Create new address
// @route   POST /api/address
// @access  Private
const createAddress = async (req, res) => {
    try {
        const {
            address_type,
            full_name,
            phone_number,
            address_line_1,
            address_line_2,
            city,
            pincode,
            is_default
        } = req.body;

        const userId = req.user._id;

        // If this is set as default, unset other defaults for this user
        if (is_default) {
            await Address.updateMany({ user: userId }, { is_default: false });
        }

        const address = new Address({
            user: userId,
            address_type: address_type || 'home',
            full_name,
            phone_number,
            address_line_1,
            address_line_2,
            city,
            pincode,
            is_default: is_default || false
        });

        const savedAddress = await address.save();
        res.status(201).json({ status: true, message: 'Address created successfully', data: savedAddress });
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};

// @desc    Get all addresses for a user
// @route   GET /api/address
// @access  Private
const getAllAddresses = async (req, res) => {
    try {
        const userId = req.user._id;
        const addresses = await Address.find({ user: userId }).sort({ is_default: -1, createdAt: -1 });
        res.status(200).json({ status: true, data: addresses });
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};

// @desc    Get single address by numeric id
// @route   GET /api/address/:id
// @access  Private
const getAddressById = async (req, res) => {
    try {
        const addressId = req.params.id;
        const userId = req.user._id;

        const address = await Address.findOne({ id: addressId, user: userId });
        if (!address) {
            return res.status(404).json({ status: false, message: 'Address not found' });
        }

        res.status(200).json({ status: true, data: address });
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};

// @desc    Update address
// @route   PUT /api/address/:id
// @access  Private
const updateAddress = async (req, res) => {
    try {
        const addressId = req.params.id;
        const userId = req.user._id;
        const updates = req.body;

        if (updates.is_default) {
            await Address.updateMany({ user: userId }, { is_default: false });
        }

        const address = await Address.findOneAndUpdate(
            { id: addressId, user: userId },
            updates,
            { returnDocument: 'after', runValidators: true }
        );

        if (!address) {
            return res.status(404).json({ status: false, message: 'Address not found' });
        }

        res.status(200).json({ status: true, message: 'Address updated successfully', data: address });
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};

// @desc    Delete address
// @route   DELETE /api/address/:id
// @access  Private
const deleteAddress = async (req, res) => {
    try {
        const addressId = req.params.id;
        const userId = req.user._id;

        const address = await Address.findOneAndDelete({ id: addressId, user: userId });
        
        if (!address) {
            return res.status(404).json({ status: false, message: 'Address not found' });
        }

        res.status(200).json({ status: true, message: 'Address deleted successfully' });
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};

module.exports = {
    createAddress,
    getAllAddresses,
    getAddressById,
    updateAddress,
    deleteAddress
};
