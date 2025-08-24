const express = require('express');
const { requireOwnerRole } = require('../middleware/ownerAuth');
const logger = require('../utils/logger');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('../models/User');
const Order = require('../models/Order');
const Store = require('../models/Store');
const Courier = require('../models/Courier');

const router = express.Router();

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
    const activeCouriers = await User.count({
      where: {
        role: 'courier',
        is_active: true
      }
    });

    const activeStores = await Store.count({
      where: {
        status: 'open'
      }
    });

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

module.exports = router;
