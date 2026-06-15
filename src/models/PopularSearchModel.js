const mongoose = require('mongoose');

const PopularSearchSchema = new mongoose.Schema({
    term: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    order: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

module.exports = mongoose.model('PopularSearch', PopularSearchSchema);
