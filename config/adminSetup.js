import User from '../models/User.js';

const createAdminUser = async () => {
  try {
    // Check if admin user already exists
    const existingAdmin = await User.findOne({ username: 'admin' });
    
    if (!existingAdmin) {
      // Create default admin user
      const adminUser = new User({
        username: 'admin',
        password: 'admin123', // This will be hashed by the pre-save middleware
        role: 'admin'
      });

      await adminUser.save();
      console.log('✅ Default admin user created successfully');
      console.log('📋 Admin Credentials:');
      console.log('   Username: admin');
      console.log('   Password: admin123');
    } else {
      console.log('✅ Admin user already exists');
    }
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  }
};

export default createAdminUser;