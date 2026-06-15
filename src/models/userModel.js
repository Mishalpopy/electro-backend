const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Counter = require('./CounterModel');

const userSchema = new mongoose.Schema({
    id: {
        type: Number,
        unique: true,
    },
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        minlength: [1, 'Name must be at least 1 characters'],
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            'Please add a valid email',
        ],
    },
    phone: {
        type: String,
        required: [true, 'Phone number is required'],
        unique: true,
        match: [
            /^\d{10,15}$/,
            'Phone number must be between 10 and 15 digits',
        ],
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters'],
        select: false,
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user',
    },
    profileImage: {
        type: String,
        default: null,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Pre-validate hook to clean phone number of non-digits
userSchema.pre('validate', function (next) {
    if (this.phone) {
        this.phone = this.phone.replace(/\D/g, '');
    }
    if (typeof next === 'function') {
        next();
    }
});

// Auto-increment User ID using Counter model and Encrypt password
userSchema.pre('save', async function () {
    const user = this;

    if (user.isNew) {
        const counter = await Counter.findOneAndUpdate(
            { id: 'user_id' },
            { $inc: { seq: 1 } },
            { returnDocument: 'after', upsert: true }
        );
        user.id = counter.seq;
    }
    
    if (user.isModified('password')) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
    }
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
