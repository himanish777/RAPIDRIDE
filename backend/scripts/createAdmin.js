import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import Admin from '../models/Admin.js';

// Load environment variables
dotenv.config();

// Admin credentials
const ADMIN_CREDENTIALS = {
  name: 'Admin User',
  email: 'admin@rapidride.com',
  password: 'admin123', // Change this to a secure password
  phone: '+91 9999999999',
  role: 'admin'
};

async function createAdminUser() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/rapidride';
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: ADMIN_CREDENTIALS.email });
    
    if (existingAdmin) {
      console.log('⚠️  Admin user already exists!');
      console.log('📧 Email:', ADMIN_CREDENTIALS.email);
      console.log('👤 Name:', existingAdmin.name);
      console.log('🎭 Role:', existingAdmin.role);
      
      process.exit(0);
    }

    // Hash the password
    console.log('🔐 Hashing password...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(ADMIN_CREDENTIALS.password, salt);

    // Create admin user
    console.log('👤 Creating admin user...');
    const adminUser = new Admin({
      name: ADMIN_CREDENTIALS.name,
      email: ADMIN_CREDENTIALS.email,
      password: hashedPassword,
      phone: ADMIN_CREDENTIALS.phone,
      role: 'admin'
    });

    await adminUser.save();

    console.log('\n✅ ========== ADMIN USER CREATED SUCCESSFULLY ==========');
    console.log('📧 Email:', ADMIN_CREDENTIALS.email);
    console.log('🔑 Password:', ADMIN_CREDENTIALS.password);
    console.log('👤 Name:', ADMIN_CREDENTIALS.name);
    console.log('📱 Phone:', ADMIN_CREDENTIALS.phone);
    console.log('🎭 Role:', ADMIN_CREDENTIALS.role);
    console.log('🆔 User ID:', adminUser._id);
    console.log('=======================================================\n');
    console.log('⚠️  IMPORTANT: Please change the password after first login!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    process.exit(1);
  }
}

// Run the script
createAdminUser();
