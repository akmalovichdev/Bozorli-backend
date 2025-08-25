const axios = require('axios');

async function testCreateStore() {
  try {
    // Сначала получим токен через логин
    const loginResponse = await axios.post('http://localhost:3000/api/v1/auth/login', {
      phone: '+998993890012',
      password: '123456'
    });
    
    console.log('Login response:', loginResponse.data);
    
    if (loginResponse.data.success) {
      const token = loginResponse.data.data.token;
      const headers = { 'Authorization': `Bearer ${token}` };
      
      // Тестируем создание магазина
      console.log('\n=== Testing POST /admin/stores ===');
      const createStoreResponse = await axios.post('http://localhost:3000/api/v1/admin/stores', {
        name: 'Тестовый магазин',
        description: 'Магазин для тестирования',
        address: 'ул. Тестовая, 123, Ташкент',
        location: {
          lat: 41.3111,
          lng: 69.2401
        },
        owner_id: 'e1297eb5-3cae-4904-86bd-8be6ccb1ccf3',
        status: 'open',
        minimum_order_amount: 50000,
        delivery_radius: 3000,
        preparation_time: 25,
        commission_rate: 12
      }, { headers });
      
      console.log('Create store response:', JSON.stringify(createStoreResponse.data, null, 2));
    }
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testCreateStore();
