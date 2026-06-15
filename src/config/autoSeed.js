const User = require('../models/userModel');
const Brand = require('../models/BrandModel');
const VehicleType = require('../models/VehicleTypeModel');
const VehicleBrand = require('../models/VehicleBrandModel');
const VehicleModel = require('../models/VehicleModel');
const Counter = require('../models/CounterModel');
const Address = require('../models/AddressModel');

const autoSeed = async () => {
    try {
        // 1. Auto-seed Admin User
        const adminExists = await User.findOne({ role: 'admin' });
        if (!adminExists) {
            const adminEmail = 'admin@mail.com';
            await User.create({
                name: 'Super Admin',
                email: adminEmail,
                phone: '971500000000',
                password: '12345678',
                role: 'admin'
            });
            console.log('Auto-seeded: Admin user created.');
        } else {
            // Update admin phone if it has changed
            adminExists.phone = '971500000000';
            await adminExists.save();
        }

        // 1.5. Auto-seed Customer User
        let customerUser = await User.findOne({ email: 'customer@mail.com' });
        if (!customerUser) {
            customerUser = await User.create({
                name: 'Paymob Test Customer',
                email: 'customer@mail.com',
                phone: '971527462872',
                password: 'password123',
                role: 'user'
            });
            console.log('Auto-seeded: Customer user created.');
        } else {
            customerUser.phone = '971527462872';
            await customerUser.save();
        }

        // 1.6. Auto-seed Address for Customer User
        const addressExists = await Address.findOne({ user: customerUser._id });
        if (!addressExists) {
            const addressCount = await Address.countDocuments();
            if (addressCount === 0) {
                await Counter.deleteMany({ id: 'address_id' });
            }
            await Address.create({
                user: customerUser._id,
                address_type: 'home',
                full_name: 'Paymob Test Customer',
                phone_number: '971527462872',
                address_line_1: 'Al Abraj St, Business Bay',
                address_line_2: 'Clover Bay Tower',
                city: 'Dubai',
                pincode: '00000',
                is_default: true
            });
            console.log('Auto-seeded: Address for Customer created.');
        }

        // 2. Auto-seed Brands (batteries/accessories) if collection is empty
        const brandCount = await Brand.countDocuments();
        if (brandCount === 0) {
            // Reset brand counter
            await Counter.deleteMany({ id: 'brand_id' });
            
            const brands = [
                { name: 'Tesla', image: 'https://logos-world.net/wp-content/uploads/2020/10/Tesla-Logo.png' },
                { name: 'Amaron', image: 'https://companieslogo.com/img/orig/AMARAJABAT.NS-6a2c9f95.png' },
                { name: 'Exide', image: 'https://logos-world.net/wp-content/uploads/2020/11/Exide-Logo.png' },
                { name: 'Bosch', image: 'https://logos-world.net/wp-content/uploads/2021/08/Bosch-Logo.png' },
                { name: 'CATL', image: 'https://logonoid.com/images/catl-logo.png' },
                { name: 'BYD', image: 'https://logos-world.net/wp-content/uploads/2022/07/BYD-Logo.png' },
                { name: 'LG Energy', image: 'https://upload.wikimedia.org/wikipedia/commons/e/e6/LG_Energy_Solution_Logo.svg' },
            ];
            for (const b of brands) {
                await Brand.create(b);
            }
            console.log('Auto-seeded: Product Brands.');
        }

        // 3. Auto-seed Vehicle Types if collection is empty
        const vehicleTypeCount = await VehicleType.countDocuments();
        if (vehicleTypeCount === 0) {
            const types = [
                { id: 'sedan', name: 'Sedan' },
                { id: 'suv', name: 'SUV' },
                { id: 'truck', name: 'Truck' },
                { id: 'coupe', name: 'Coupe' },
                { id: 'hatchback', name: 'Hatchback' }
            ];
            await VehicleType.insertMany(types);
            console.log('Auto-seeded: Vehicle Types.');
        }

        // 4. Auto-seed Vehicle Brands and Models if both collections are empty
        const vehicleBrandCount = await VehicleBrand.countDocuments();
        const vehicleModelCount = await VehicleModel.countDocuments();
        if (vehicleBrandCount === 0 && vehicleModelCount === 0) {
            // Reset vehicle counters
            await Counter.deleteMany({ id: { $in: ['vehicle_brand_id', 'vehicle_model_id'] } });

            const brands = [
                { name: 'BMW', image: 'https://static.vecteezy.com/system/resources/thumbnails/019/956/127/small/bmw-transparent-bmw-free-free-png.png', status: 'active', types: ['sedan', 'suv'] },
                { name: 'Tesla', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Tesla_logo.png/500px-Tesla_logo.png', status: 'active', types: ['sedan', 'suv'] },
                { name: 'Mercedes', image: 'https://images.seeklogo.com/logo-png/33/2/mercedes-benz-logo-png_seeklogo-332844.png', status: 'active', types: ['sedan', 'suv'] },
                { name: 'Audi', image: 'https://www.freepnglogos.com/uploads/audi-logo-21.png', status: 'active', types: ['sedan', 'suv'] }
            ];

            const brandMap = {};
            for (const b of brands) {
                const created = await VehicleBrand.create(b);
                brandMap[b.name] = created.id;
            }

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
            console.log('Auto-seeded: Vehicle Brands and Models.');
        }
    } catch (error) {
        console.error('Error during auto-seeding:', error);
    }
};

module.exports = autoSeed;
