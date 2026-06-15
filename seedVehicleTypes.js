const mongoose = require('mongoose');
const dotenv = require('dotenv');
const VehicleType = require('./src/models/VehicleTypeModel');

dotenv.config();

const types = [
    { id: 'sedan', name: 'Sedan' },
    { id: 'suv', name: 'SUV' },
    { id: 'truck', name: 'Truck' },
    { id: 'coupe', name: 'Coupe' },
    { id: 'hatchback', name: 'Hatchback' }
];

async function seed() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        await VehicleType.deleteMany({});
        console.log('Previous vehicle types cleared');

        await VehicleType.insertMany(types);
        console.log('Vehicle types seeded');

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

seed();
