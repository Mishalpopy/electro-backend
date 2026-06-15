require('dotenv').config({ override: true });
const connectDB = require('./src/config/db');
const User = require('./src/models/userModel');

const seedAdmin = async () => {
    try {
        await connectDB();

        const adminEmail = 'admin@mail.com';
        
        // Check if admin already exists
        let admin = await User.findOne({ email: adminEmail });
        
        if (admin) {
            console.log(`Admin user with email ${adminEmail} already exists! Updating...`);
            admin.role = 'admin';
            admin.password = '12345678';
            await admin.save();
            console.log('Admin user updated successfully!');
        } else {
            // Create new admin
            admin = await User.create({
                name: 'Super Admin',
                email: adminEmail,
                phone: '99' + Math.floor(10000000 + Math.random() * 90000000).toString(), // Random 10-digit phone
                password: '12345678',
                role: 'admin'
            });
            console.log(`Admin user seeded successfully!`);
        }

        process.exit();
    } catch (error) {
        console.error('Error seeding admin user:', error);
        process.exit(1);
    }
};

seedAdmin();
