const mongoose = require('mongoose');
const VehicleBrand = require('./src/models/VehicleBrandModel');
const VehicleModel = require('./src/models/VehicleModel');
const Counter = require('./src/models/CounterModel');
require('dotenv').config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/electro';

const seedData = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        // Clear existing vehicle brands and models for a fresh start 
        await VehicleModel.deleteMany({});
        await VehicleBrand.deleteMany({});
        await Counter.deleteMany({ id: { $in: ['vehicle_brand_id', 'vehicle_model_id'] } });

        console.log('Previous vehicle brands/models cleared');

        const brands = [
            { name: 'BMW', image: 'https://static.vecteezy.com/system/resources/thumbnails/019/956/127/small/bmw-transparent-bmw-free-free-png.png', status: 'active', types: ['sedan', 'suv'] },
            { name: 'Tesla', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Tesla_logo.png/500px-Tesla_logo.png', status: 'active', types: ['sedan', 'suv'] },
            { name: 'Mercedes', image: 'https://images.seeklogo.com/logo-png/33/2/mercedes-benz-logo-png_seeklogo-332844.png', status: 'active', types: ['sedan', 'suv'] },
            { name: 'Audi', image: 'https://www.freepnglogos.com/uploads/audi-logo-21.png', status: 'active', types: ['sedan', 'suv'] }
        ];

        const brandMap = {}; // { name: id }
        for (const b of brands) {
            const created = await VehicleBrand.create(b);
            brandMap[b.name] = created.id;
        }
        console.log('Brands seeded');

        // Seed Models
        const models = [
            { brand_name: 'BMW', name: 'i4 eDrive40', type: 'sedan', image: 'https://electro-mobile-app.s3.amazonaws.com/vehicles/bmw-i4.png', status: 'active' },
            { brand_name: 'BMW', name: 'i7 xDrive60', type: 'sedan', image: 'https://electro-mobile-app.s3.amazonaws.com/vehicles/bmw-i7.png', status: 'active' },
            { brand_name: 'BMW', name: 'iX xDrive40', type: 'suv', image: 'https://electro-mobile-app.s3.amazonaws.com/vehicles/bmw-ix.png', status: 'active' },
            { brand_name: 'BMW', name: 'iX3', type: 'suv', image: 'https://electro-mobile-app.s3.amazonaws.com/vehicles/bmw-ix3.png', status: 'active' },
            { brand_name: 'Tesla', name: 'Model S', type: 'sedan', image: 'https://electro-mobile-app.s3.amazonaws.com/vehicles/tesla-s.png', status: 'active' },
            { brand_name: 'Tesla', name: 'Model X', type: 'suv', image: 'https://electro-mobile-app.s3.amazonaws.com/vehicles/tesla-x.png', status: 'active' }
        ];

        for (const m of models) {
            const brand_id = brandMap[m.brand_name];
            if (brand_id) {
                const { brand_name, ...modelData } = m;
                await VehicleModel.create({ ...modelData, brand_id });
            }
        }
        console.log('Vehicle models seeded');

        mongoose.connection.close();
        console.log('Done');
    } catch (error) {
        console.error('Error seeding data:', error);
        process.exit(1);
    }
};

seedData();
