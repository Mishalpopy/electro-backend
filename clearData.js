const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('./src/models/ProductModel');
const Brand = require('./src/models/BrandModel');
const Counter = require('./src/models/CounterModel');
const Wishlist = require('./src/models/WishlistModel');
const Cart = require('./src/models/CartModel');
const Order = require('./src/models/OrderModel');
const autoSeed = require('./src/config/autoSeed');

dotenv.config();

async function run() {
    try {
        if (!process.env.MONGODB_URI) {
            console.error('Error: MONGODB_URI is not defined in environment variables.');
            process.exit(1);
        }

        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected successfully!');

        console.log('Clearing Products...');
        await Product.deleteMany({});

        console.log('Clearing Brands...');
        await Brand.deleteMany({});

        console.log('Clearing Wishlists...');
        await Wishlist.deleteMany({});

        console.log('Clearing Carts...');
        await Cart.deleteMany({});

        console.log('Clearing Orders...');
        await Order.deleteMany({});

        console.log('Resetting Counters...');
        await Counter.deleteMany({ id: { $in: ['product_id', 'brand_id'] } });

        console.log('Running auto-seeding...');
        await autoSeed();

        console.log('Database successfully cleared and re-seeded!');
        process.exit(0);
    } catch (err) {
        console.error('Error clearing database:', err);
        process.exit(1);
    }
}

run();
