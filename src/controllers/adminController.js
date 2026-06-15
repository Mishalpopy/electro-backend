const User = require('../models/userModel');
const PopularSearch = require('../models/PopularSearchModel');

// @desc    Get all customers
const getCustomers = async (req, res) => {
    try {
        const customers = await User.find({ role: 'user' }).select('-password');
        res.status(200).json({ status: true, data: customers });
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};

// @desc    Delete a customer
const deleteCustomer = async (req, res) => {
    try {
        const user = await User.findOne({ id: req.params.id });

        if (user) {
            if (user.role === 'admin') {
                return res.status(400).json({ status: false, message: 'Cannot delete an admin' });
            }
            await User.deleteOne({ id: req.params.id });
            res.status(200).json({ status: true, message: 'Customer removed' });
        } else {
            res.status(404).json({ status: false, message: 'Customer not found' });
        }
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};

// @desc    Get all popular searches (Admin)
const getAllPopularSearches = async (req, res) => {
    try {
        const searches = await PopularSearch.find().sort({ order: 1 });
        res.status(200).json({ status: true, data: searches });
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};

// @desc    Create popular search
const createPopularSearch = async (req, res) => {
    try {
        const { term, order } = req.body;
        const search = await PopularSearch.create({ term, order });
        res.status(201).json({ status: true, message: 'Search term added', data: search });
    } catch (error) {
        res.status(400).json({ status: false, message: error.message });
    }
};

// @desc    Delete popular search
const deletePopularSearch = async (req, res) => {
    try {
        const search = await PopularSearch.findByIdAndDelete(req.params.id);
        if (!search) return res.status(404).json({ status: false, message: 'Search term not found' });
        res.status(200).json({ status: true, message: 'Search term removed' });
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};

module.exports = {
    getCustomers,
    deleteCustomer,
    getAllPopularSearches,
    createPopularSearch,
    deletePopularSearch,
};
