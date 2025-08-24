require('dotenv').config({ path: './.env' });
const bcrypt = require('bcryptjs');
const { sequelize } = require('../src/config/database');
const User = require('../src/models/User');

async function createOwner() {
  try {
    console.log('🔧 Starting owner creation...');
    
    await sequelize.authenticate();
    console.log('✅ Database connection established.');

    // Check if owner already exists
    const existingOwner = await User.findOne({
      where: { role: 'owner' }
    });

    if (existingOwner) {
      console.log('⚠️  Owner already exists:', existingOwner.phone);
      console.log('Role:', existingOwner.role);
      return;
    }

    console.log('📝 Creating owner user...');

    // Create owner user
    const hashedPassword = await bcrypt.hash('admin123', 12);
    
    const owner = await User.create({
      phone: '+998901234567',
      email: 'owner@bozorli.uz',
      fullName: 'Bozorli Owner',
      password: hashedPassword,
      role: 'owner',
      isVerified: true,
      isActive: true
    });

    console.log('✅ Owner created successfully:');
    console.log('📱 Phone:', owner.phone);
    console.log('🔑 Password: admin123');
    console.log('👤 Role:', owner.role);
    console.log('🆔 ID:', owner.id);

  } catch (error) {
    console.error('❌ Error creating owner:', error);
  } finally {
    await sequelize.close();
    console.log('🔌 Database connection closed.');
  }
}

createOwner();
