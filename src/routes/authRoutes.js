const express = require('express');
const router = express.Router();
const { register, login, adminLogin, getProfile, updateProfile, deleteAccount } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.post('/register', register);
router.post('/login', login);
router.post('/admin-login', adminLogin);   // Admin only — rejects non-admin role
router.get('/profile', protect, getProfile);
router.put('/profile', protect, upload.single('image'), updateProfile);
router.delete('/profile', protect, deleteAccount);

module.exports = router;
