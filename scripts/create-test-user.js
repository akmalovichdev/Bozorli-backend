require('dotenv').config({ path: './.env' });
const { sequelize } = require('../src/config/database');
const User = require('../src/models/User');

async function createTestUser() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established.');

    // Создаем тестового пользователя для приложения
    const user = await User.create({
      phone: '+998993890012',
      email: 'akmalovichdev@yandex.com',
      fullName: 'Нурик Ахматов',
      password: '123456',
      role: 'customer',
      isVerified: true,
    });

    console.log('✅ Test user created:', user.id);
    console.log('Phone:', user.phone);
    console.log('Password: 123456');

  } catch (error) {
    console.error('❌ Error creating test user:', error);
  } finally {
    await sequelize.close();
  }
}

createTestUser();
