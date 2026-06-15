const mongoose = require('mongoose');
const Brand = require('./src/models/BrandModel');
const dotenv = require('dotenv');

dotenv.config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected...');
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
};

const brands = [
    {
        name: 'Tesla',
        image: 'https://logos-world.net/wp-content/uploads/2020/10/Tesla-Logo.png',
    },
    {
        name: 'Amaron',
        image: 'https://companieslogo.com/img/orig/AMARAJABAT.NS-6a2c9f95.png',
    },
    {
        name: 'Exide',
        image: 'https://logos-world.net/wp-content/uploads/2020/11/Exide-Logo.png',
    },
    {
        name: 'Bosch',
        image: 'https://logos-world.net/wp-content/uploads/2021/08/Bosch-Logo.png',
    },
    {
        name: 'CATL',
        image: 'https://logonoid.com/images/catl-logo.png',
    },
    {
        name: 'BYD',
        image: 'https://logos-world.net/wp-content/uploads/2022/07/BYD-Logo.png',
    },
    {
        name: 'LG Energy',
        image: 'https://upload.wikimedia.org/wikipedia/commons/e/e6/LG_Energy_Solution_Logo.svg',
    },
];

const seedBrands = async () => {
    try {
        await connectDB();
        await Brand.deleteMany();
        for (const brandData of brands) {
            await Brand.create(brandData);
        }
        console.log('Brands Seeded!');
        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

seedBrands();
