const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function testCreateStoreWithFiles() {
  try {
    // Сначала получим токен через логин
    const loginResponse = await axios.post('http://localhost:3000/api/v1/auth/login', {
      phone: '+998993890012',
      password: '123456'
    });
    
    console.log('Login response:', loginResponse.data);
    
    if (loginResponse.data.success) {
      const token = loginResponse.data.data.token;
      const headers = { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data'
      };
      
      // Создаем FormData
      const formData = new FormData();
      
      // Добавляем основные поля
      formData.append('name', 'Тестовый магазин с файлами');
      formData.append('description', 'Магазин для тестирования загрузки файлов');
      formData.append('address', 'ул. Тестовая, 456, Ташкент');
      formData.append('location[lat]', '41.3111');
      formData.append('location[lng]', '69.2401');
      formData.append('owner_id', 'e1297eb5-3cae-4904-86bd-8be6ccb1ccf3');
      formData.append('status', 'open');
      formData.append('rating', '0');
      formData.append('total_ratings', '0');
      formData.append('minimum_order_amount', '50000');
      formData.append('delivery_radius', '3000');
      formData.append('preparation_time', '25');
      formData.append('commission_rate', '12');
      formData.append('contact_phone', '+998901234567');
      formData.append('contact_email', 'test@example.com');
      formData.append('tax_id', '123456789');
      formData.append('bank_account', '1234567890123456');
      formData.append('auto_accept_orders', 'false');
      formData.append('notifications_enabled', 'true');
      
      // Добавляем время работы
      const openHours = {
        monday: { open: '09:00', close: '18:00' },
        tuesday: { open: '09:00', close: '18:00' },
        wednesday: { open: '09:00', close: '18:00' },
        thursday: { open: '09:00', close: '18:00' },
        friday: { open: '09:00', close: '18:00' },
        saturday: { open: '09:00', close: '18:00' },
        sunday: { open: '10:00', close: '16:00' }
      };
      formData.append('open_hours', JSON.stringify(openHours));
      
      // Создаем тестовые файлы
      const uploadDir = path.join(__dirname, 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      // Создаем тестовый текстовый файл для логотипа
      const logoPath = path.join(uploadDir, 'test-logo.txt');
      fs.writeFileSync(logoPath, 'Test logo content');
      
      // Создаем тестовый текстовый файл для баннера
      const bannerPath = path.join(uploadDir, 'test-banner.txt');
      fs.writeFileSync(bannerPath, 'Test banner content');
      
      // Создаем тестовый текстовый файл для лицензии
      const licensePath = path.join(uploadDir, 'test-license.txt');
      fs.writeFileSync(licensePath, 'Test license content');
      
      // Добавляем файлы в FormData
      formData.append('logo', fs.createReadStream(logoPath));
      formData.append('banner', fs.createReadStream(bannerPath));
      formData.append('business_license', fs.createReadStream(licensePath));
      
      // Тестируем создание магазина
      console.log('\n=== Testing POST /admin/stores with files ===');
      const createStoreResponse = await axios.post('http://localhost:3000/api/v1/admin/stores', formData, { 
        headers: {
          ...headers,
          ...formData.getHeaders()
        }
      });
      
      console.log('Create store response:', JSON.stringify(createStoreResponse.data, null, 2));
      
      // Удаляем тестовые файлы
      fs.unlinkSync(logoPath);
      fs.unlinkSync(bannerPath);
      fs.unlinkSync(licensePath);
    }
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testCreateStoreWithFiles();
