const mongoose = require('mongoose');
const Counter = require('./CounterModel');

const bannerSchema = new mongoose.Schema({
    id: {
        type: Number,
        unique: true,
    },
    title: {
        type: String,
        required: [true, 'Banner title is required'],
        trim: true,
    },
    subtitle: {
        type: String,
        required: [true, 'Banner subtitle is required'],
        trim: true,
    },
    image: {
        type: String,
        required: [true, 'Banner image is required'],
    },
    link: {
        type: String,
        default: '',
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

bannerSchema.pre('save', async function () {
    const banner = this;
    if (banner.isNew) {
        try {
            const counter = await Counter.findOneAndUpdate(
                { id: 'banner_id' },
                { $inc: { seq: 1 } },
                { returnDocument: 'after', upsert: true }
            );
            if (!counter) {
              const newCounter = new Counter({ id: 'banner_id', seq: 1 });
              await newCounter.save();
              banner.id = 1;
            } else {
              banner.id = counter.seq;
            }
        } catch (error) {
            console.error('Error in Banner sequence generation:', error);
            throw error;
        }
    }
});

module.exports = mongoose.model('Banner', bannerSchema);
