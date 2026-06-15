const mongoose = require('mongoose');
const dotenv = require('dotenv');
const VehicleType = require('./src/models/VehicleTypeModel');
const VehicleBrand = require('./src/models/VehicleBrandModel');
const VehicleModel = require('./src/models/VehicleModel');
const Counter = require('./src/models/CounterModel');

dotenv.config();

const vehicleTypes = [
    { id: 'car', name: 'Car' },
    { id: 'bike', name: 'Bike' },
    { id: 'scooter', name: 'Scooter' },
    { id: 'truck', name: 'Truck' }
];

const brands = [
    { 
        name: 'BMW', 
        image: 'https://static.vecteezy.com/system/resources/thumbnails/019/956/127/small/bmw-transparent-bmw-free-free-png.png',
        types: ['car']
    },
    { 
        name: 'Tesla', 
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Tesla_logo.png/500px-Tesla_logo.png',
        types: ['car']
    },
    { 
        name: 'Yamaha', 
        image: 'https://companieslogo.com/img/orig/YAMHF-013627d7.png',
        types: ['bike']
    },
    { 
        name: 'Honda', 
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Honda_Logo.svg/2560px-Honda_Logo.svg.png',
        types: ['car', 'bike', 'scooter']
    },
    { 
        name: 'Volvo', 
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/Volvo-Iron-Mark-Logo.svg/1024px-Volvo-Iron-Mark-Logo.svg.png',
        types: ['car', 'truck']
    },
    { 
        name: 'Vespa', 
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Vespa_logo.svg/2560px-Vespa_logo.svg.png',
        types: ['scooter']
    }
];

const models = [
    // BMW
    { brand: 'BMW', name: 'BMW M5', type: 'car', image: 'https://platform.cstatic-images.com/xlarge/in/v2/stock_photos/0e123497-88ab-4091-a6e5-397a7e37e96b/3f78e478-f09c-4f81-9b7e-967a5b3a4c0a.png' },
    { brand: 'BMW', name: 'BMW X5', type: 'car', image: 'https://w7.pngwing.com/pngs/434/960/png-transparent-bmw-x5-car-bmw-x6-bmw-x3-luxury-suv-compact-car-sedan-performance-car.png' },
    
    // Tesla
    { brand: 'Tesla', name: 'Model S', type: 'car', image: 'https://pngimg.com/uploads/tesla_car/tesla_car_PNG1.png' },
    { brand: 'Tesla', name: 'Model 3', type: 'car', image: 'https://images.info-tesla.ru/2021/04/Tesla-Model-3-Face.png' },
    
    // Yamaha
    { brand: 'Yamaha', name: 'R15 V4', type: 'bike', image: 'https://yamaha.com.pk/wp-content/uploads/2021/10/R15V4-Racing-Blue-Side-600x450.png' },
    { brand: 'Yamaha', name: 'MT-15', type: 'bike', image: 'https://yamaha-motor-india.com/paddock/wp-content/uploads/2022/04/MT15V2-Cyan-Storm.png' },
    
    // Honda
    { brand: 'Honda', name: 'Honda Civic', type: 'car', image: 'https://pngimg.com/uploads/honda/honda_PNG10350.png' },
    { brand: 'Honda', name: 'CBR 150R', type: 'bike', image: 'https://www.hondaph.com/wp-content/uploads/2021/02/CBR150R-Winning-Red-1.png' },
    { brand: 'Honda', name: 'Activa 6G', type: 'scooter', image: 'https://imgd.aeplcdn.com/1280x720/n/cw/ec/44407/activa-6g-right-side-view-2.jpeg' },
    
    // Volvo
    { brand: 'Volvo', name: 'Volvo XC90', type: 'car', image: 'https://w7.pngwing.com/pngs/351/361/png-transparent-volvo-xc90-volvo-cars-volvo-v90-volvo-v40-volvo-compact-car-sedan-car.png' },
    { brand: 'Volvo', name: 'Volvo FH16', type: 'truck', image: 'https://w7.pngwing.com/pngs/206/490/png-transparent-volvo-fh-truck-semi-trailer-truck-volvo-f-series-truck-cargo-truck-transport.png' },

    // Vespa
    { brand: 'Vespa', name: 'Vespa VXL 150', type: 'scooter', image: 'https://imgd.aeplcdn.com/1280x720/n/cw/ec/48545/vxl-150-right-side-view-1.jpeg' }
];

async function seed() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Clear existing data
        await VehicleType.deleteMany({});
        await VehicleBrand.deleteMany({});
        await VehicleModel.deleteMany({});
        await Counter.deleteMany({ id: { $in: ['vehicle_brand_id', 'vehicle_model_id'] } });
        console.log('Cleared existing vehicle data');

        // Seed Types
        await VehicleType.insertMany(vehicleTypes);
        console.log('Vehicle types seeded');

        // Seed Brands (will auto-increment IDs)
        const brandMap = {}; // name -> id
        for (const b of brands) {
            const created = await VehicleBrand.create(b);
            brandMap[b.name] = created.id;
        }
        console.log('Vehicle brands seeded');

        // Seed Models
        for (const m of models) {
            const brand_id = brandMap[m.brand];
            if (brand_id) {
                await VehicleModel.create({
                    brand_id: brand_id,
                    name: m.name,
                    type: m.type,
                    image: m.image,
                    status: 'active'
                });
            }
        }
        console.log('Vehicle models seeded');

        console.log('Seeding completed successfully!');
        process.exit();
    } catch (err) {
        console.error('Seeding error:', err);
        process.exit(1);
    }
}

seed();
