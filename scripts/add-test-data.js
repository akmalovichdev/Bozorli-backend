require('dotenv').config({ path: './.env' });
const { sequelize } = require('../src/config/database');
const Store = require('../src/models/Store');
const Product = require('../src/models/Product');
const User = require('../src/models/User');

async function addTestData() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established.');

    // Создаем тестового владельца магазина
    const owner = await User.create({
      phone: '+998901234567',
      email: 'store.owner@example.com',
      fullName: 'Владелец магазина',
      password: '123456',
      role: 'merchant',
      isVerified: true,
    });

    console.log('✅ Test store owner created:', owner.id);

    // Создаем тестовый магазин
    const store = await Store.create({
      ownerId: owner.id,
      name: 'Магазин "Свежие Продукты"',
      address: 'ул. Навои, 15, Ташкент',
      location: {
        type: 'Point',
        coordinates: [69.2797, 41.3111]
      },
      openHours: {
        monday: { open: '08:00', close: '22:00' },
        tuesday: { open: '08:00', close: '22:00' },
        wednesday: { open: '08:00', close: '22:00' },
        thursday: { open: '08:00', close: '22:00' },
        friday: { open: '08:00', close: '22:00' },
        saturday: { open: '09:00', close: '21:00' },
        sunday: { open: '09:00', close: '20:00' },
      },
      status: 'open',
      rating: 4.5,
    });

    console.log('✅ Test store created:', store.id);

    // Создаем тестовые продукты
    const products = await Product.bulkCreate([
      {
        storeId: store.id,
        sku: 'MILK001',
        name: 'Молоко 3.2%',
        description: 'Свежее пастеризованное молоко',
        price: 12000,
        unit: 'шт',
        images: ['https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&h=400&fit=crop'],
        attributes: { volume: '1л', fat: '3.2%' },
        category: 'Молочные',
        inStock: true,
      },
      {
        storeId: store.id,
        sku: 'CHEESE001',
        name: 'Сыр Российский',
        description: 'Твердый сыр Российский',
        price: 45000,
        unit: 'кг',
        images: ['https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=400&h=400&fit=crop'],
        attributes: { weight: '1кг', type: 'твердый' },
        category: 'Молочные',
        inStock: true,
      },
      {
        storeId: store.id,
        sku: 'BREAD001',
        name: 'Хлеб белый',
        description: 'Свежий белый хлеб',
        price: 3000,
        unit: 'шт',
        images: ['https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=400&fit=crop'],
        attributes: { weight: '500г', type: 'белый' },
        category: 'Хлеб',
        inStock: true,
      },
      {
        storeId: store.id,
        sku: 'MEAT001',
        name: 'Говядина',
        description: 'Свежая говядина',
        price: 85000,
        unit: 'кг',
        images: ['https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=400&fit=crop'],
        attributes: { weight: '1кг', type: 'говядина' },
        category: 'Мясо',
        inStock: true,
      },
      {
        storeId: store.id,
        sku: 'VEG001',
        name: 'Помидоры',
        description: 'Свежие помидоры',
        price: 15000,
        unit: 'кг',
        images: ['https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=400&h=400&fit=crop'],
        attributes: { weight: '1кг', type: 'помидоры' },
        category: 'Овощи',
        inStock: true,
      },
    ]);

    console.log('✅ Test products created:', products.length);

    console.log('\n🎉 Test data added successfully!');
    console.log('Store ID:', store.id);
    console.log('Products count:', products.length);

  } catch (error) {
    console.error('❌ Error adding test data:', error);
  } finally {
    await sequelize.close();
  }
}

addTestData();
