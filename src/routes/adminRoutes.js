const express = require('express');
const router = express.Router();
const { 
    getCustomers, 
    deleteCustomer, 
    getAllPopularSearches, 
    createPopularSearch, 
    deletePopularSearch 
} = require('../controllers/adminController');
const { protect, admin } = require('../middleware/authMiddleware');

router.get('/customers', protect, admin, getCustomers);
router.delete('/customers/:id', protect, admin, deleteCustomer);

router.get('/popular-searches', protect, admin, getAllPopularSearches);
router.post('/popular-searches', protect, admin, createPopularSearch);
router.delete('/popular-searches/:id', protect, admin, deletePopularSearch);

module.exports = router;
