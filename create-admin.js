// Create admin user script
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

async function createAdmin() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/assignmentlikho');
        
        // Create admin user
        const adminPassword = 'admin123'; // Change this to your desired password
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        
        const adminUser = new User({
            name: 'Admin',
            email: 'admin@example.com', // Change this to your admin email
            password: hashedPassword,
            isAdmin: true,
            college: 'Admin College',
            course: 'Administration'
        });

        await adminUser.save();
        console.log('Admin user created successfully!');
        console.log('Email:', adminUser.email);
        console.log('Password:', adminPassword);
    } catch (error) {
        console.error('Error creating admin:', error);
    } finally {
        await mongoose.connection.close();
    }
}

createAdmin();