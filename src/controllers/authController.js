const authService = require('../services/authService');

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
    try {
        let { name, email, phone, password, confirm_password } = req.body;

        if (phone && typeof phone === 'string') {
            phone = phone.replace(/\D/g, '');
        }

        // Validation logic
        if (!name || typeof name !== 'string' || name.trim().length < 2) {
            return res.status(400).json({ message: 'Name is required and should be at least 2 characters long' });
        }
        if (!email || !/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
            return res.status(400).json({ message: 'A valid email is required' });
        }
        if (!phone || !/^\d{10,15}$/.test(phone)) {
            return res.status(400).json({ message: 'Phone number is required and must be between 10 and 15 digits' });
        }
        if (!password || password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters long' });
        }
        if (password !== confirm_password) {
            return res.status(400).json({ message: 'Passwords do not match' });
        }

        const result = await authService.registerUser({
            name,
            email,
            phone,
            password
        });

        res.status(201).json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Authenticate user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const result = await authService.loginUser(email, password);
        res.status(200).json(result);
    } catch (error) {
        // Return 401 for authentication failure (invalid email or password)
        res.status(401).json({ message: error.message });
    }
};

// @desc    Admin Only Login
// @route   POST /api/auth/admin-login
// @access  Public (but restricted to admin role)
const adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const result = await authService.loginUser(email, password);

        if (result.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin accounts only.' });
        }

        res.status(200).json(result);
    } catch (error) {
        res.status(401).json({ message: error.message });
    }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getProfile = async (req, res) => {
    try {
        const { id, name, email, phone, profileImage } = req.user;
        res.status(200).json({
            id,
            name,
            email,
            phone,
            profileImage
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
    try {
        let profileImage;
        if (req.file) {
            const host = req.get('host');
            const protocol = req.protocol;
            profileImage = `${protocol}://${host}/uploads/${req.file.filename}`;
        }

        const updateData = {
            ...req.body,
            profileImage
        };

        const result = await authService.updateUserProfile(req.user._id, updateData);
        res.status(200).json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const deleteAccount = async (req, res) => {
    try {
        await authService.deleteUserAccount(req.user._id);
        res.status(200).json({ status: true, message: 'Account deleted successfully' });
    } catch (error) {
        res.status(400).json({ status: false, message: error.message });
    }
};

module.exports = {
    register,
    login,
    adminLogin,
    getProfile,
    updateProfile,
    deleteAccount,
};
