# Bozorli Backend API

Backend API для платформы доставки продуктов Bozorli.

## 🚀 Технологии

- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **MySQL** - База данных
- **Sequelize** - ORM для работы с базой данных
- **JWT** - Аутентификация
- **Swagger** - API документация
- **Socket.IO** - Real-time обновления
- **Winston** - Логирование

## 📋 Требования

- Node.js 16+ 
- MySQL 8.0+
- npm или yarn

## 🛠️ Установка

1. **Клонируйте репозиторий и перейдите в папку backend:**
```bash
cd backend
```

2. **Установите зависимости:**
```bash
npm install
```

3. **Создайте файл .env на основе env.example:**
```bash
cp env.example .env
```

4. **Настройте переменные окружения в .env:**
```env
# Server Configuration
NODE_ENV=development
PORT=3000
API_VERSION=v1

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=bozorli_db
DB_USER=root
DB_PASSWORD=your_password
DB_DIALECT=mysql

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
```

5. **Создайте базу данных MySQL:**
```sql
CREATE DATABASE bozorli_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## 🚀 Запуск

### Режим разработки
```bash
npm run dev
```

### Продакшн режим
```bash
npm start
```

### Тесты
```bash
npm test
```

## 📚 API Документация

После запуска сервера, документация Swagger доступна по адресу:
- **Swagger UI**: http://localhost:3000/api-docs
- **Health Check**: http://localhost:3000/health

## 🗄️ Структура базы данных

### Основные таблицы:

1. **users** - Пользователи (покупатели, магазины, курьеры, админы)
2. **stores** - Магазины
3. **products** - Товары
4. **orders** - Заказы

### Связи:
- User (1) → (N) Store (owner)
- User (1) → (N) Order (customer)
- User (1) → (N) Order (courier)
- Store (1) → (N) Product
- Store (1) → (N) Order

## 🔐 Аутентификация

API использует JWT токены для аутентификации. Включите токен в заголовок:
```
Authorization: Bearer <your-jwt-token>
```

### Доступные эндпоинты аутентификации:

- `POST /api/v1/auth/register` - Регистрация
- `POST /api/v1/auth/login` - Вход с паролем
- `POST /api/v1/auth/otp/send` - Отправка OTP
- `POST /api/v1/auth/otp/verify` - Проверка OTP
- `POST /api/v1/auth/refresh` - Обновление токена
- `POST /api/v1/auth/logout` - Выход
- `GET /api/v1/auth/me` - Профиль пользователя

## 📁 Структура проекта

```
src/
├── config/          # Конфигурации (база данных, etc.)
├── controllers/     # Контроллеры (бизнес-логика)
├── middleware/      # Middleware (аутентификация, валидация)
├── models/          # Модели Sequelize
├── routes/          # Роуты API
├── services/        # Сервисы (внешние API, утилиты)
├── types/           # TypeScript типы
├── utils/           # Утилиты (логирование, helpers)
└── index.js         # Точка входа
```

## 🔧 Конфигурация

### Переменные окружения:

- `NODE_ENV` - Окружение (development/production)
- `PORT` - Порт сервера
- `DB_*` - Настройки базы данных
- `JWT_*` - Настройки JWT токенов
- `TWILIO_*` - Настройки SMS (Twilio)
- `CLICK_*` - Настройки платежной системы Click
- `PAYME_*` - Настройки платежной системы Payme

## 📊 Логирование

Логи сохраняются в папку `logs/`:
- `app.log` - Все логи
- `error.log` - Только ошибки
- `exceptions.log` - Необработанные исключения

## 🔄 Миграции

Для синхронизации базы данных:
```bash
npm run migrate
```

## 🌱 Сидовые данные

Для заполнения тестовыми данными:
```bash
npm run seed
```

## 🧪 Тестирование

```bash
# Запуск всех тестов
npm test

# Запуск тестов в режиме watch
npm run test:watch
```

## 📦 Скрипты

- `npm start` - Запуск в продакшн режиме
- `npm run dev` - Запуск в режиме разработки с nodemon
- `npm test` - Запуск тестов
- `npm run lint` - Проверка кода
- `npm run lint:fix` - Исправление ошибок линтера
- `npm run migrate` - Синхронизация базы данных
- `npm run seed` - Заполнение тестовыми данными

## 🔒 Безопасность

- JWT токены с истечением срока действия
- Хеширование паролей с bcrypt
- Rate limiting для защиты от DDoS
- Валидация входных данных
- CORS настройки
- Helmet для защиты заголовков

## 📞 Поддержка

Для вопросов и поддержки обращайтесь к команде разработки.

