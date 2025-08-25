const axios = require('axios');

async function testCreateUser() {
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
      
      // Тестируем создание пользователя
      console.log('\n=== Testing POST /admin/users ===');
      const createUserResponse = await axios.post('http://localhost:3000/api/v1/admin/users', {
        phone: '+998901234568',
        email: 'merchant@example.com',
        full_name: 'Тестовый Мерчант',
        role: 'merchant',
        password: '123456',
        wallet_balance: 0,
        is_active: true
      }, { headers });
      
      console.log('Create user response:', JSON.stringify(createUserResponse.data, null, 2));
    }
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testCreateUser();
