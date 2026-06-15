const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        let connString;
        if (process.env.NODE_ENV === 'development') {
            connString = process.env.MONGODB_URI || process.env.MONGO_PUBLIC_URL || process.env.MONGO_URL;
        } else {
            connString = process.env.MONGODB_URI || process.env.MONGO_URL || process.env.MONGO_PUBLIC_URL;
        }
        
        // If no direct connection URL is available, try to construct it from individual components
        if (!connString && process.env.MONGOHOST) {
            const user = process.env.MONGOUSER || process.env.MONGO_INITDB_ROOT_USERNAME || 'mongo';
            const pass = process.env.MONGOPASSWORD || process.env.MONGO_INITDB_ROOT_PASSWORD;
            const host = process.env.MONGOHOST;
            const port = process.env.MONGOPORT || '27017';
            
            if (pass) {
                connString = `mongodb://${user}:${pass}@${host}:${port}/admin?authSource=admin`;
            } else {
                connString = `mongodb://${host}:${port}`;
            }
        }

        if (!connString) {
            console.log("No MongoDB environment configuration found. Falling back to local default.");
            connString = 'mongodb://localhost:27017/electro';
        }

        console.log(`Connecting to MongoDB...`);
        const conn = await mongoose.connect(connString);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`MongoDB connection error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
