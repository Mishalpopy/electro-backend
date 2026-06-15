const mongoose = require('mongoose');
const VehicleBrand = require('./src/models/VehicleBrandModel');
const VehicleModel = require('./src/models/VehicleModel');
require('dotenv').config();

const brands = [
    { name: 'BMW', image: 'https://static.vecteezy.com/system/resources/thumbnails/019/956/127/small/bmw-transparent-bmw-free-free-png.png' },
    { name: 'Tesla', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Tesla_logo.png/500px-Tesla_logo.png' },
    { name: 'Mercedes', image: 'https://images.seeklogo.com/logo-png/33/2/mercedes-benz-logo-png_seeklogo-332844.png' },
    { name: 'Audi', image: 'https://www.freepnglogos.com/uploads/audi-logo-21.png' }
];

const seedVehicleBrands = async () => {
    try {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/electro';
        await mongoose.connect(uri);
        console.log('Connected to MongoDB');

        await VehicleBrand.deleteMany();
        console.log('Vehicle Brands cleared');

        for (const brand of brands) {
            await VehicleBrand.create(brand);
        }
        console.log('Vehicle Brands seeded');

        // Optional: Update models to point to these new brands if IDs changed
        // But since we use auto-increment IDs, they should be 1, 2, 3, 4 etc.
        // The previous models seeded were also using 1, 2, 3 etc.

        console.log('Seeding completed');
        process.exit();
    } catch (error) {
        console.error('Error seeding vehicle brands:', error);
        process.exit(1);
    }
};

seedVehicleBrands();
