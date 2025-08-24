require('dotenv').config({ path: './.env' });
const bcrypt = require('bcryptjs');
const { sequelize } = require('../src/config/database');
const User = require('../src/models/User');
const Store = require('../src/models/Store');
const Order = require('../src/models/Order');

async function createTestData() {
  try {
    console.log('🔧 Starting test data creation...');
    
    await sequelize.authenticate();
    console.log('✅ Database connection established.');

    // Create test users
    console.log('📝 Creating test users...');
    
    const hashedPassword = await bcrypt.hash('123456', 12);
    
    const users = await User.bulkCreate([
      {
        phone: '+998901234567',
        email: 'customer1@example.com',
        full_name: 'Алиса Иванова',
        password: hashedPassword,
        role: 'customer',
        wallet_balance: 50000,
        is_verified: true,
        is_active: true
      },
      {
        phone: '+998901234568',
        email: 'merchant1@example.com',
        full_name: 'Борис Петров',
        password: hashedPassword,
        role: 'merchant',
        wallet_balance: 100000,
        is_verified: true,
        is_active: true
      },
      {
        phone: '+998901234569',
        email: 'courier1@example.com',
        full_name: 'Виктор Сидоров',
        password: hashedPassword,
        role: 'courier',
        wallet_balance: 25000,
        is_verified: true,
        is_active: true
      },
      {
        phone: '+998901234570',
        email: 'customer2@example.com',
        full_name: 'Галина Козлова',
        password: hashedPassword,
        role: 'customer',
        wallet_balance: 75000,
        is_verified: true,
        is_active: true
      },
      {
        phone: '+998901234571',
        email: 'merchant2@example.com',
        full_name: 'Дмитрий Волков',
        password: hashedPassword,
        role: 'merchant',
        wallet_balance: 150000,
        is_verified: true,
        is_active: true
      }
    ]);

    console.log(`✅ Created ${users.length} test users`);

    // Create test stores
    console.log('🏪 Creating test stores...');
    
    const merchant1 = users.find(u => u.role === 'merchant' && u.phone === '+998901234568');
    const merchant2 = users.find(u => u.role === 'merchant' && u.phone === '+998901234571');
    
    const stores = await Store.bulkCreate([
      {
        name: 'Ресторан "У Бориса"',
        description: 'Лучшие блюда домашней кухни',
        address: 'ул. Навои, 15, Ташкент',
        location: sequelize.fn('ST_GeomFromText', 'POINT(69.2164 41.2995)'),
        owner_id: merchant1.id,
        status: 'open',
        rating: 4.5,
        total_ratings: 127,
        minimum_order_amount: 50000,
        delivery_radius: 3000,
        preparation_time: 25,
        commission_rate: 12.00,
        contact_phone: '+998901234568',
        contact_email: 'merchant1@example.com'
      },
      {
        name: 'Кафе "Дмитрий"',
        description: 'Современная европейская кухня',
        address: 'пр. Амира Темура, 45, Ташкент',
        location: sequelize.fn('ST_GeomFromText', 'POINT(69.2401 41.3111)'),
        owner_id: merchant2.id,
        status: 'open',
        rating: 4.2,
        total_ratings: 89,
        minimum_order_amount: 75000,
        delivery_radius: 5000,
        preparation_time: 35,
        commission_rate: 15.00,
        contact_phone: '+998901234571',
        contact_email: 'merchant2@example.com'
      }
    ]);

    console.log(`✅ Created ${stores.length} test stores`);

    // Create test orders
    console.log('📦 Creating test orders...');
    
    const customer1 = users.find(u => u.role === 'customer' && u.phone === '+998901234567');
    const customer2 = users.find(u => u.role === 'customer' && u.phone === '+998901234570');
    const courier1 = users.find(u => u.role === 'courier' && u.phone === '+998901234569');
    
    const orders = await Order.bulkCreate([
      {
        user_id: customer1.id,
        store_id: stores[0].id,
        total_amount: 85000,
        subtotal_amount: 75000,
        delivery_fee: 10000,
        commission_amount: 9000,
        payment_method: 'card',
        status: 'completed',
        assigned_courier_id: courier1.id,
        idempotency_key: 'order-1-' + Date.now(),
        delivery_address: {
          latitude: 41.2995,
          longitude: 69.2164,
          text: 'ул. Навои, 10, Ташкент'
        },
        items: [
          {
            name: 'Плов',
            price: 45000,
            quantity: 1
          },
          {
            name: 'Салат',
            price: 30000,
            quantity: 1
          }
        ],
        customer_phone: customer1.phone,
        customer_name: customer1.full_name,
        payment_status: 'paid',
        confirmed_at: new Date(Date.now() - 86400000), // 1 day ago
        delivered_at: new Date(Date.now() - 82800000), // 23 hours ago
        created_at: new Date(Date.now() - 86400000)
      },
      {
        user_id: customer2.id,
        store_id: stores[1].id,
        total_amount: 120000,
        subtotal_amount: 100000,
        delivery_fee: 20000,
        commission_amount: 15000,
        payment_method: 'cash',
        status: 'delivered',
        assigned_courier_id: courier1.id,
        idempotency_key: 'order-2-' + Date.now(),
        delivery_address: {
          latitude: 41.3111,
          longitude: 69.2401,
          text: 'пр. Амира Темура, 50, Ташкент'
        },
        items: [
          {
            name: 'Стейк',
            price: 80000,
            quantity: 1
          },
          {
            name: 'Картофель',
            price: 20000,
            quantity: 1
          }
        ],
        customer_phone: customer2.phone,
        customer_name: customer2.full_name,
        payment_status: 'paid',
        confirmed_at: new Date(Date.now() - 3600000), // 1 hour ago
        delivered_at: new Date(Date.now() - 1800000), // 30 minutes ago
        created_at: new Date(Date.now() - 7200000) // 2 hours ago
      },
      {
        user_id: customer1.id,
        store_id: stores[0].id,
        total_amount: 65000,
        subtotal_amount: 55000,
        delivery_fee: 10000,
        commission_amount: 6600,
        payment_method: 'wallet',
        status: 'courier_assigned',
        assigned_courier_id: courier1.id,
        idempotency_key: 'order-3-' + Date.now(),
        delivery_address: {
          latitude: 41.2995,
          longitude: 69.2164,
          text: 'ул. Навои, 20, Ташкент'
        },
        items: [
          {
            name: 'Шашлык',
            price: 35000,
            quantity: 1
          },
          {
            name: 'Хлеб',
            price: 20000,
            quantity: 1
          }
        ],
        customer_phone: customer1.phone,
        customer_name: customer1.full_name,
        payment_status: 'paid',
        confirmed_at: new Date(),
        assigned_at: new Date(),
        created_at: new Date(Date.now() - 1800000) // 30 minutes ago
      },
      {
        user_id: customer2.id,
        store_id: stores[1].id,
        total_amount: 95000,
        subtotal_amount: 75000,
        delivery_fee: 20000,
        commission_amount: 11250,
        payment_method: 'card',
        status: 'confirmed',
        idempotency_key: 'order-4-' + Date.now(),
        delivery_address: {
          latitude: 41.3111,
          longitude: 69.2401,
          text: 'пр. Амира Темура, 60, Ташкент'
        },
        items: [
          {
            name: 'Паста',
            price: 55000,
            quantity: 1
          },
          {
            name: 'Суп',
            price: 20000,
            quantity: 1
          }
        ],
        customer_phone: customer2.phone,
        customer_name: customer2.full_name,
        payment_status: 'paid',
        confirmed_at: new Date(),
        created_at: new Date(Date.now() - 300000) // 5 minutes ago
      }
    ]);

    console.log(`✅ Created ${orders.length} test orders`);

    console.log('🎉 Test data creation completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`- Users: ${users.length}`);
    console.log(`- Stores: ${stores.length}`);
    console.log(`- Orders: ${orders.length}`);

  } catch (error) {
    console.error('❌ Error creating test data:', error);
  } finally {
    await sequelize.close();
    console.log('🔌 Database connection closed.');
  }
}

createTestData();
