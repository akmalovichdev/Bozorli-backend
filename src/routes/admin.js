const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireOwnerRole } = require('../middleware/ownerAuth');
const logger = require('../utils/logger');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('../models/User');
const Order = require('../models/Order');
const Store = require('../models/Store');
const Courier = require('../models/Courier');

const router = express.Router();

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    // Разрешаем изображения, документы и текстовые файлы для тестирования
    if (file.mimetype.startsWith('image/') || 
        file.mimetype === 'application/pdf' ||
        file.mimetype === 'application/msword' ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.mimetype === 'text/plain' ||
        file.mimetype === 'text/html') {
      cb(null, true);
    } else {
      cb(new Error('Неподдерживаемый тип файла'), false);
    }
  }
});

// Apply owner authentication to all admin routes
router.use(requireOwnerRole);

/**
 * @swagger
 * /admin/dashboard/stats:
 *   get:
 *     summary: Get dashboard statistics (Owner only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics retrieved successfully
 *       403:
 *         description: Access denied - Owner role required
 */
router.get('/dashboard/stats', async (req, res) => {
  try {
    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get total orders and revenue
    const totalOrders = await Order.count();
    const totalRevenue = await Order.sum('total_amount', {
      where: {
        status: ['completed', 'delivered'],
        payment_status: 'paid'
      }
    });

    // Get active couriers and stores
    const activeCouriers = await Courier.count({
      where: {
        status: ['idle', 'busy'] // Считаем курьеров которые онлайн и доступны
      }
    });

    const activeStores = await Store.count({
      where: {
        status: 'open'
      }
    });

    // Debug logging
    logger.info(`Dashboard stats - Active couriers: ${activeCouriers}, Active stores: ${activeStores}`);
    
    // Also get total counts for debugging
    const totalCouriers = await Courier.count();
    const totalStores = await Store.count();
    logger.info(`Dashboard stats - Total couriers: ${totalCouriers}, Total stores: ${totalStores}`);

    // Get pending orders
    const pendingOrders = await Order.count({
      where: {
        status: ['confirmed', 'assigning', 'courier_assigned']
      }
    });

    // Get today's completed orders and revenue
    const completedOrdersToday = await Order.count({
      where: {
        status: ['completed', 'delivered'],
        created_at: {
          [Op.gte]: today,
          [Op.lt]: tomorrow
        }
      }
    });

    const revenueToday = await Order.sum('total_amount', {
      where: {
        status: ['completed', 'delivered'],
        payment_status: 'paid',
        created_at: {
          [Op.gte]: today,
          [Op.lt]: tomorrow
        }
      }
    });

    // Get orders by status
    const ordersByStatus = await Order.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['status'],
      raw: true
    });

    const statusCounts = {};
    ordersByStatus.forEach(item => {
      statusCounts[item.status.toUpperCase()] = parseInt(item.count);
    });

    const stats = {
      total_orders: totalOrders || 0,
      total_revenue: parseFloat(totalRevenue || 0).toFixed(2),
      active_couriers: activeCouriers || 0,
      active_stores: activeStores || 0,
      pending_orders: pendingOrders || 0,
      completed_orders_today: completedOrdersToday || 0,
      revenue_today: parseFloat(revenueToday || 0).toFixed(2),
      orders_by_status: {
        CREATED: statusCounts.CREATED || 0,
        PAYMENT_PENDING: statusCounts.PAYMENT_PENDING || 0,
        CONFIRMED: statusCounts.CONFIRMED || 0,
        ASSIGNING: statusCounts.ASSIGNING || 0,
        COURIER_ASSIGNED: statusCounts.COURIER_ASSIGNED || 0,
        EN_ROUTE_TO_STORE: statusCounts.EN_ROUTE_TO_STORE || 0,
        AT_STORE: statusCounts.AT_STORE || 0,
        PICKING: statusCounts.PICKING || 0,
        EN_ROUTE_TO_CUSTOMER: statusCounts.EN_ROUTE_TO_CUSTOMER || 0,
        DELIVERED: statusCounts.DELIVERED || 0,
        COMPLETED: statusCounts.COMPLETED || 0,
        CANCELLED: statusCounts.CANCELLED || 0,
        REFUNDED: statusCounts.REFUNDED || 0
      }
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard statistics'
    });
  }
});

/**
 * @swagger
 * /admin/orders:
 *   get:
 *     summary: Get all orders (Owner only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Orders retrieved successfully
 *       403:
 *         description: Access denied - Owner role required
 */
router.get('/orders', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status;
    const offset = (page - 1) * limit;

    // Build where clause
    const whereClause = {};
    if (status) {
      whereClause.status = status;
    }

    // Get orders with pagination
    const { count, rows: orders } = await Order.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'customer',
          attributes: ['id', 'phone', 'full_name']
        },
        {
          model: Store,
          as: 'store',
          attributes: ['id', 'name', 'address']
        },
        {
          model: User,
          as: 'courier',
          attributes: ['id', 'phone', 'full_name'],
          where: { role: 'courier' },
          required: false
        }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    const totalPages = Math.ceil(count / limit);

    res.json({
      success: true,
      data: {
        data: orders,
        total: count,
        page,
        limit,
        total_pages: totalPages
      }
    });
  } catch (error) {
    logger.error('Admin orders error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get orders'
    });
  }
});

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: Get all users (Owner only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *       403:
 *         description: Access denied - Owner role required
 */
router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const role = req.query.role;
    const offset = (page - 1) * limit;

    // Build where clause
    const whereClause = {};
    if (role) {
      whereClause.role = role;
    }

    // Get users with pagination
    const { count, rows: users } = await User.findAndCountAll({
      where: whereClause,
      attributes: { exclude: ['password'] },
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    const totalPages = Math.ceil(count / limit);

    res.json({
      success: true,
      data: {
        data: users,
        total: count,
        page,
        limit,
        total_pages: totalPages
      }
    });
  } catch (error) {
    logger.error('Admin users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get users'
    });
  }
});

/**
 * @swagger
 * /admin/users:
 *   post:
 *     summary: Create a new user (Owner only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - full_name
 *               - role
 *             properties:
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *               full_name:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [customer, merchant, courier, admin]
 *               password:
 *                 type: string
 *               wallet_balance:
 *                 type: number
 *               is_active:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Access denied - Owner role required
 */
router.post('/users', async (req, res) => {
  try {
    const {
      phone,
      email,
      full_name,
      role,
      password = '123456', // Default password
      wallet_balance = 0,
      is_active = true
    } = req.body;

    // Validate required fields
    if (!phone || !full_name || !role) {
      return res.status(400).json({
        success: false,
        error: 'Phone, full_name, and role are required'
      });
    }

    // Check if phone already exists
    const existingUser = await User.findOne({ where: { phone } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User with this phone number already exists'
      });
    }

    // Hash password
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await User.create({
      phone,
      email,
      full_name,
      role,
      password: hashedPassword,
      wallet_balance,
      is_active,
      is_verified: true
    });

    logger.info(`User created: ${user.id} with role: ${role}`);

    // Remove password from response
    const userResponse = user.toJSON();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      data: userResponse
    });
  } catch (error) {
    logger.error('Create user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create user'
    });
  }
});

/**
 * @swagger
 * /admin/stores:
 *   get:
 *     summary: Get all stores (Owner only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Stores retrieved successfully
 *       403:
 *         description: Access denied - Owner role required
 */
router.get('/stores', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status;
    const offset = (page - 1) * limit;

    // Build where clause
    const whereClause = {};
    if (status) {
      whereClause.status = status === 'active' ? 'open' : 'closed';
    }

    // Get stores with pagination
    const { count, rows: stores } = await Store.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'phone', 'full_name']
        }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    const totalPages = Math.ceil(count / limit);

    res.json({
      success: true,
      data: {
        data: stores,
        total: count,
        page,
        limit,
        total_pages: totalPages
      }
    });
  } catch (error) {
    logger.error('Admin stores error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get stores'
    });
  }
});

/**
 * @swagger
 * /admin/couriers:
 *   get:
 *     summary: Get all couriers (Owner only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Couriers retrieved successfully
 *       403:
 *         description: Access denied - Owner role required
 */
router.get('/couriers', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status;
    const offset = (page - 1) * limit;

    // Build where clause
    const whereClause = {
      role: 'courier'
    };
    if (status) {
      whereClause.is_active = status === 'active';
    }

    // Get couriers with pagination
    const { count, rows: couriers } = await User.findAndCountAll({
      where: whereClause,
      attributes: { exclude: ['password'] },
      include: [
        {
          model: Courier,
          as: 'courierProfile',
          attributes: ['status', 'current_location', 'last_seen']
        }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    const totalPages = Math.ceil(count / limit);

    res.json({
      success: true,
      data: {
        data: couriers,
        total: count,
        page,
        limit,
        total_pages: totalPages
      }
    });
  } catch (error) {
    logger.error('Admin couriers error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get couriers'
    });
  }
});

/**
 * @swagger
 * /admin/stores:
 *   post:
 *     summary: Create a new store (Owner only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - address
 *               - location
 *               - owner_id
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               address:
 *                 type: string
 *               location:
 *                 type: object
 *                 properties:
 *                   lat:
 *                     type: number
 *                   lng:
 *                     type: number
 *               owner_id:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [open, closed, temporarily_closed]
 *               open_hours:
 *                 type: object
 *               minimum_order_amount:
 *                 type: number
 *               delivery_radius:
 *                 type: number
 *               preparation_time:
 *                 type: number
 *               commission_rate:
 *                 type: number
 *     responses:
 *       201:
 *         description: Store created successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Access denied - Owner role required
 */
router.post('/stores', upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'banner', maxCount: 1 },
  { name: 'business_license', maxCount: 1 }
]), async (req, res) => {
  try {
    const {
      name,
      description,
      address,
      owner_id,
      status = 'open',
      rating = 0,
      total_ratings = 0,
      open_hours,
      minimum_order_amount = 0,
      delivery_radius = 5000,
      preparation_time = 30,
      commission_rate = 10,
      contact_phone = '',
      contact_email = '',
      tax_id = '',
      bank_account = '',
      auto_accept_orders = false,
      notifications_enabled = true
    } = req.body;

    // Обработка файлов
    const logo = req.files?.logo?.[0]?.filename || '';
    const banner = req.files?.banner?.[0]?.filename || '';
    const business_license = req.files?.business_license?.[0]?.filename || '';

    // Обработка location - поддерживаем разные форматы
    let location;
    if (req.body['location[lat]'] && req.body['location[lng]']) {
      location = { 
        lat: parseFloat(req.body['location[lat]']), 
        lng: parseFloat(req.body['location[lng]']) 
      };
    } else if (req.body.location && typeof req.body.location === 'string') {
      try {
        location = JSON.parse(req.body.location);
      } catch (error) {
        location = { lat: 41.3111, lng: 69.2401 }; // Default Tashkent coordinates
      }
    } else {
      location = { lat: 41.3111, lng: 69.2401 }; // Default Tashkent coordinates
    }

    // Validate required fields
    if (!name || !address || !location || !owner_id) {
      return res.status(400).json({
        success: false,
        error: 'Name, address, location, and owner_id are required'
      });
    }

    // Обработка open_hours
    let parsedOpenHours = open_hours;
    if (typeof open_hours === 'string') {
      try {
        parsedOpenHours = JSON.parse(open_hours);
      } catch (error) {
        logger.error('Error parsing open_hours:', error);
        parsedOpenHours = null;
      }
    }

    // Validate location format
    if (!location.lat || !location.lng) {
      return res.status(400).json({
        success: false,
        error: 'Location must have lat and lng coordinates'
      });
    }

    // Check if owner exists
    const owner = await User.findByPk(owner_id);
    if (!owner) {
      return res.status(400).json({
        success: false,
        error: 'Owner not found'
      });
    }

    // Create store
    const store = await Store.create({
      name,
      description,
      address,
      location: sequelize.fn('ST_GeomFromText', `POINT(${location.lng} ${location.lat})`),
      owner_id,
      status,
      rating,
      total_ratings,
      open_hours: parsedOpenHours || {
        monday: { open: '09:00', close: '21:00' },
        tuesday: { open: '09:00', close: '21:00' },
        wednesday: { open: '09:00', close: '21:00' },
        thursday: { open: '09:00', close: '21:00' },
        friday: { open: '09:00', close: '21:00' },
        saturday: { open: '09:00', close: '21:00' },
        sunday: { open: '09:00', close: '21:00' }
      },
      minimum_order_amount,
      delivery_radius,
      preparation_time,
      commission_rate,
      logo,
      banner,
      contact_phone,
      contact_email,
      business_license,
      tax_id,
      bank_account,
      auto_accept_orders,
      notifications_enabled
    });

    logger.info(`Store created: ${store.id} by owner: ${owner_id}`);

    res.status(201).json({
      success: true,
      data: store
    });
  } catch (error) {
    logger.error('Create store error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create store'
    });
  }
});

/**
 * @swagger
 * /admin/stores/{id}:
 *   put:
 *     summary: Update store (Owner only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Store ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               address:
 *                 type: string
 *               location[lat]:
 *                 type: number
 *               location[lng]:
 *                 type: number
 *               owner_id:
 *                 type: integer
 *               status:
 *                 type: string
 *                 enum: [open, closed, temporarily_closed]
 *               rating:
 *                 type: number
 *               total_ratings:
 *                 type: integer
 *               open_hours:
 *                 type: string
 *               minimum_order_amount:
 *                 type: number
 *               delivery_radius:
 *                 type: number
 *               preparation_time:
 *                 type: integer
 *               commission_rate:
 *                 type: number
 *               logo:
 *                 type: string
 *                 format: binary
 *               banner:
 *                 type: string
 *                 format: binary
 *               business_license:
 *                 type: string
 *                 format: binary
 *               contact_phone:
 *                 type: string
 *               contact_email:
 *                 type: string
 *               tax_id:
 *                 type: string
 *               bank_account:
 *                 type: string
 *               auto_accept_orders:
 *                 type: boolean
 *               notifications_enabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Store updated successfully
 *       400:
 *         description: Bad request
 *       404:
 *         description: Store not found
 *       403:
 *         description: Access denied - Owner role required
 */
router.put('/stores/:id', upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'banner', maxCount: 1 },
  { name: 'business_license', maxCount: 1 }
]), async (req, res) => {
  try {
    const storeId = req.params.id; // Используем строку как есть, не парсим в число
    
    // Check if store exists
    const existingStore = await Store.findByPk(storeId);
    if (!existingStore) {
      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });
    }

    const {
      name, description, address,
      'location[lat]': lat, 'location[lng]': lng,
      owner_id, status, rating, total_ratings,
      open_hours, minimum_order_amount, delivery_radius,
      preparation_time, commission_rate,
      contact_phone, contact_email, business_license: body_business_license,
      tax_id, bank_account, auto_accept_orders, notifications_enabled
    } = req.body;

    // Process uploaded files
    const logo = req.files?.logo?.[0]?.filename || existingStore.logo;
    const banner = req.files?.banner?.[0]?.filename || existingStore.banner;
    const business_license = req.files?.business_license?.[0]?.filename || body_business_license || existingStore.business_license;

    // Process location
    let location = existingStore.location;
    if (req.body['location[lat]'] && req.body['location[lng]']) {
      const lat = parseFloat(req.body['location[lat]']);
      const lng = parseFloat(req.body['location[lng]']);
      if (!isNaN(lat) && !isNaN(lng)) {
        location = { lat, lng };
      }
    } else if (req.body.location && typeof req.body.location === 'string') {
      try {
        const parsedLocation = JSON.parse(req.body.location);
        if (parsedLocation && typeof parsedLocation === 'object' && 
            parsedLocation.lat !== undefined && parsedLocation.lng !== undefined) {
          location = parsedLocation;
        }
      } catch (error) {
        logger.error('Error parsing location:', error);
      }
    }

    // Process open_hours
    let parsedOpenHours = existingStore.open_hours;
    if (open_hours) {
      if (typeof open_hours === 'string') {
        try {
          parsedOpenHours = JSON.parse(open_hours);
        } catch (error) {
          logger.error('Error parsing open_hours:', error);
        }
      } else {
        parsedOpenHours = open_hours;
      }
    }

    // Update store
    const updateData = {
      name: name || existingStore.name,
      description: description || existingStore.description,
      address: address || existingStore.address,
      location: location && location.lat !== undefined && location.lng !== undefined ? 
        sequelize.fn('ST_GeomFromText', `POINT(${location.lng} ${location.lat})`) : 
        existingStore.location,
      owner_id: owner_id || existingStore.owner_id,
      status: status || existingStore.status,
      rating: rating !== undefined ? (isNaN(parseFloat(rating)) ? existingStore.rating : parseFloat(rating)) : existingStore.rating,
      total_ratings: total_ratings !== undefined ? (isNaN(parseInt(total_ratings)) ? existingStore.total_ratings : parseInt(total_ratings)) : existingStore.total_ratings,
      open_hours: parsedOpenHours,
      minimum_order_amount: minimum_order_amount !== undefined ? (isNaN(parseFloat(minimum_order_amount)) ? existingStore.minimum_order_amount : parseFloat(minimum_order_amount)) : existingStore.minimum_order_amount,
      delivery_radius: delivery_radius !== undefined ? (isNaN(parseFloat(delivery_radius)) ? existingStore.delivery_radius : parseFloat(delivery_radius)) : existingStore.delivery_radius,
      preparation_time: preparation_time !== undefined ? (isNaN(parseInt(preparation_time)) ? existingStore.preparation_time : parseInt(preparation_time)) : existingStore.preparation_time,
      commission_rate: commission_rate !== undefined ? (isNaN(parseFloat(commission_rate)) ? existingStore.commission_rate : parseFloat(commission_rate)) : existingStore.commission_rate,
      logo,
      banner,
      contact_phone: contact_phone || existingStore.contact_phone,
      contact_email: contact_email || existingStore.contact_email,
      business_license,
      tax_id: tax_id || existingStore.tax_id,
      bank_account: bank_account || existingStore.bank_account,
      auto_accept_orders: auto_accept_orders !== undefined ? auto_accept_orders === 'true' : existingStore.auto_accept_orders,
      notifications_enabled: notifications_enabled !== undefined ? notifications_enabled === 'true' : existingStore.notifications_enabled
    };

    await existingStore.update(updateData);

    logger.info(`Store updated: ${storeId}`);

    res.json({
      success: true,
      data: existingStore
    });
  } catch (error) {
    logger.error('Update store error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update store'
    });
  }
});

/**
 * @swagger
 * /admin/stores/{id}:
 *   delete:
 *     summary: Delete store (Owner only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Store ID
 *     responses:
 *       200:
 *         description: Store deleted successfully
 *       404:
 *         description: Store not found
 *       403:
 *         description: Access denied - Owner role required
 */
router.delete('/stores/:id', async (req, res) => {
  try {
    const storeId = req.params.id;
    
    // Check if store exists
    const existingStore = await Store.findByPk(storeId);
    if (!existingStore) {
      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });
    }

    // Delete store
    await existingStore.destroy();

    logger.info(`Store deleted: ${storeId}`);

    res.json({
      success: true,
      message: 'Store deleted successfully'
    });
  } catch (error) {
    logger.error('Delete store error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete store'
    });
  }
});

module.exports = router;
