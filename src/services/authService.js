const User = require('../models/userModel');
const jwt = require('jsonwebtoken');

const signToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

const registerUser = async (userData) => {
    const { name, email, phone, password } = userData;

    // Check if user exists by email or phone
    const userExists = await User.findOne({ $or: [{ email }, { phone }] });
    if (userExists) {
        if (userExists.email === email) {
            throw new Error('User with this email already exists');
        }
        if (userExists.phone === phone) {
            throw new Error('User with this phone number already exists');
        }
    }

    // Create user
    const user = await User.create({
        name,
        email,
        phone,
        password,
    });

    if (user) {
        return {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            token: signToken(user._id),
        };
    } else {
        throw new Error('Invalid user data');
    }
};

const loginUser = async (email, password) => {
    // Find user by email
    const user = await User.findOne({ email }).select('+password');

    if (user && (await user.matchPassword(password))) {
        return {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            token: signToken(user._id),
        };
    } else {
        throw new Error('Invalid email or password');
    }
};

const updateUserProfile = async (userId, updateData) => {
    const { name, email, phone, current_password, new_password, profileImage } = updateData;

    // Find user by MongoDB _id (which is in userId)
    const user = await User.findById(userId).select('+password');

    if (!user) {
        throw new Error('User not found');
    }

    // Verify current password
    if (!current_password) {
        throw new Error('Current password is required to update profile');
    }

    const isMatch = await user.matchPassword(current_password);
    if (!isMatch) {
        throw new Error('Incorrect current password');
    }

    // Update fields
    if (name) user.name = name;
    if (email) {
        const emailTaken = await User.findOne({ email, _id: { $ne: userId } });
        if (emailTaken) throw new Error('Email already in use');
        user.email = email;
    }
    if (phone) {
        const phoneTaken = await User.findOne({ phone, _id: { $ne: userId } });
        if (phoneTaken) throw new Error('Phone number already in use');
        user.phone = phone;
    }
    if (new_password) user.password = new_password;
    if (profileImage !== undefined) user.profileImage = profileImage;

    await user.save();

    return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profileImage: user.profileImage,
        token: signToken(user._id),
    };
};

const deleteUserAccount = async (userId) => {
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
        throw new Error('User not found');
    }
    return { message: 'User account deleted successfully' };
};

module.exports = {
    registerUser,
    loginUser,
    updateUserProfile,
    deleteUserAccount,
};
