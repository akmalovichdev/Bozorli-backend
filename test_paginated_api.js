const axios = require('axios');

async function testPaginatedAPI() {
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
      
      // Тестируем разные пагинированные endpoints
      console.log('\n=== Testing /admin/users ===');
      const usersResponse = await axios.get('http://localhost:3000/api/v1/admin/users?page=1&limit=10', { headers });
      console.log('Users response:', JSON.stringify(usersResponse.data, null, 2));
      
      console.log('\n=== Testing /admin/stores ===');
      const storesResponse = await axios.get('http://localhost:3000/api/v1/admin/stores?page=1&limit=10', { headers });
      console.log('Stores response:', JSON.stringify(storesResponse.data, null, 2));
      
      console.log('\n=== Testing /admin/orders ===');
      const ordersResponse = await axios.get('http://localhost:3000/api/v1/admin/orders?page=1&limit=10', { headers });
      console.log('Orders response:', JSON.stringify(ordersResponse.data, null, 2));
      
      console.log('\n=== Testing /admin/couriers ===');
      const couriersResponse = await axios.get('http://localhost:3000/api/v1/admin/couriers?page=1&limit=10', { headers });
      console.log('Couriers response:', JSON.stringify(couriersResponse.data, null, 2));
    }
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testPaginatedAPI();
