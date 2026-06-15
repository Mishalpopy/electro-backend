const mongoose = require('mongoose');
const Counter = require('./CounterModel');

const categorySchema = new mongoose.Schema({
    id: {
        type: Number,
        unique: true,
    },
    name: {
        type: String,
        required: [true, 'Category name is required'],
        trim: true,
    },
    icon: {
        type: String,
        required: [true, 'Icon is required'],
    },
    type: {
        type: String,
        required: [true, 'Type is required'],
        unique: true,
        trim: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

categorySchema.pre('save', async function () {
    const category = this;
    if (category.isNew) {
        const counter = await Counter.findOneAndUpdate(
            { id: 'category_id' },
            { $inc: { seq: 1 } },
            { returnDocument: 'after', upsert: true }
        );
        category.id = counter.seq;
    }
});

module.exports = mongoose.model('Category', categorySchema);
