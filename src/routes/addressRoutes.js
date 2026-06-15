const express = require('express');
const router = express.Router();
const {
    createAddress,
    getAllAddresses,
    getAddressById,
    updateAddress,
    deleteAddress
} = require('../controllers/addressController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect); // All address routes are private

router.post('/', createAddress);
router.get('/', getAllAddresses);
router.get('/:id', getAddressById);
router.put('/:id', updateAddress);
router.delete('/:id', deleteAddress);

module.exports = router;
