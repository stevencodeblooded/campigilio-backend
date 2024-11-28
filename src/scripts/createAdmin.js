const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Verify environment variables
if (!process.env.MONGODB_URI) {
    console.error('\x1b[31m%s\x1b[0m', 'Error: MONGODB_URI is not defined in .env file');
    console.log('Please make sure your .env file contains:');
    console.log('MONGODB_URI=your_mongodb_connection_string');
    process.exit(1);
}

// Define the Admin model schema
const adminSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Username is required'],
        unique: true,
        trim: true
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: 8,
        select: false
    },
    role: {
        type: String,
        enum: ['admin', 'super-admin'],
        default: 'admin'
    },
    lastLogin: Date
}, {
    timestamps: true
});

// Hash password before saving
adminSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

const Admin = mongoose.model('Admin', adminSchema);

async function createAdminUser() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('Successfully connected to MongoDB.');

        const adminData = {
            username: 'admin',
            password: 'admin123!@#',
            role: 'super-admin'
        };

        // Check if admin already exists
        const existingAdmin = await Admin.findOne({ username: adminData.username });
        
        if (existingAdmin) {
            console.log('\x1b[33m%s\x1b[0m', 'Admin user already exists');
            await mongoose.connection.close();
            return;
        }

        // Create new admin
        const admin = await Admin.create(adminData);
        console.log('\x1b[32m%s\x1b[0m', 'Admin user created successfully!');
        console.log('Username:', adminData.username);
        console.log('Password:', adminData.password);
        
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', 'Error creating admin:', error.message);
    } finally {
        await mongoose.connection.close();
        console.log('Database connection closed.');
    }
}

createAdminUser();