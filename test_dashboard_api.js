const axios = require('axios');

async function testDashboardAPI() {
  try {
    // Сначала получим токен через логин
    const loginResponse = await axios.post('http://localhost:3000/api/v1/auth/login', {
      phone: '+998993890012',
      password: '123456'
    });
    
    console.log('Login response:', loginResponse.data);
    
    if (loginResponse.data.success) {
      const token = loginResponse.data.data.token;
      
      // Теперь получим статистику dashboard
      const dashboardResponse = await axios.get('http://localhost:3000/api/v1/admin/dashboard/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('Dashboard response:', JSON.stringify(dashboardResponse.data, null, 2));
    }
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testDashboardAPI();
