const mongoose = require('mongoose');
const dotenv = require('dotenv');
const VehicleModel = require('./src/models/VehicleModel');
const VehicleType = require('./src/models/VehicleTypeModel');

dotenv.config();

async function cleanup() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Clean up models
        const models = await VehicleModel.find({});
        for (let model of models) {
            const trimmedType = model.type.trim();
            if (model.type !== trimmedType) {
                model.type = trimmedType;
                await model.save();
                console.log(`Trimmed model type for: ${model.name}`);
            }
        }

        // Clean up types
        const types = await VehicleType.find({});
        for (let type of types) {
            const trimmedId = type.id.trim();
            if (type.id !== trimmedId) {
                type.id = trimmedId;
                await type.save();
                console.log(`Trimmed category ID for: ${type.name}`);
            }
        }

        console.log('Cleanup complete');
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

cleanup();
