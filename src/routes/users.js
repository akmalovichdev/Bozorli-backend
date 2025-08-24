const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/User');
const Order = require('../models/Order');
const Store = require('../models/Store');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * /api/v1/users/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/User'
 */
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: req.user.toJSON()
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get profile'
    });
  }
});

/**
 * @swagger
 * /api/v1/users/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *               gender:
 *                 type: string
 *                 enum: [male, female, other]
 *               avatar:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation error
 */
router.put('/profile', [
  authenticateToken,
  body('fullName').optional().isLength({ min: 2, max: 100 }),
  body('email').optional().isEmail(),
  body('dateOfBirth').optional().isISO8601(),
  body('gender').optional().isIn(['male', 'female', 'other']),
  body('avatar').optional().isURL()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { fullName, email, dateOfBirth, gender, avatar } = req.body;
    const user = req.user;

    // Check if email is already taken by another user
    if (email && email !== user.email) {
      const existingUser = await User.findByEmail(email);
      if (existingUser && existingUser.id !== user.id) {
        return res.status(409).json({
          success: false,
          error: 'Email is already taken'
        });
      }
    }

    // Update user fields
          if (fullName) user.full_name = fullName;
    if (email) user.email = email;
          if (dateOfBirth) user.date_of_birth = dateOfBirth;
    if (gender) user.gender = gender;
    if (avatar) user.avatar = avatar;

    await user.save();

    logger.info(`User profile updated: ${user.id}`);

    res.json({
      success: true,
      data: user.toJSON()
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
});

/**
 * @swagger
 * /api/v1/users/orders:
 *   get:
 *     summary: Get user order history
 *     tags: [Users]
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
 *           enum: [created, payment_pending, confirmed, assigning, courier_assigned, en_route_to_store, at_store, picking, en_route_to_customer, delivered, completed, cancelled, refunded]
 *     responses:
 *       200:
 *         description: Order history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Order'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
router.get('/orders', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(String(req.query.page || 1));
    const limit = Math.min(parseInt(String(req.query.limit || 20)), 100);
    const offset = (page - 1) * limit;
    const status = req.query.status ? String(req.query.status) : undefined;

    const where = { user_id: req.user.id };
    if (status) Object.assign(where, { status });

    const { rows, count } = await Order.findAndCountAll({
      where,
      include: [
        {
          model: Store,
          as: 'store',
          attributes: ['id', 'name', 'address', 'logo']
        },
        {
          model: Order.sequelize.models.User,
          as: 'courier',
          attributes: ['id', 'full_name', 'phone', 'avatar']
        }
      ],
      offset,
      limit,
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    logger.error('Get user orders error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load orders'
    });
  }
});

/**
 * @swagger
 * /api/v1/users/wallet:
 *   get:
 *     summary: Get user wallet balance
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wallet balance retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     balance:
 *                       type: number
 *                     currency:
 *                       type: string
 */
router.get('/wallet', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        balance: Number(req.user.wallet_balance),
        currency: 'UZS'
      }
    });
  } catch (error) {
    logger.error('Get wallet error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get wallet balance'
    });
  }
});

/**
 * @swagger
 * /api/v1/users/wallet/transactions:
 *   get:
 *     summary: Get user wallet transactions
 *     tags: [Users]
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
 *     responses:
 *       200:
 *         description: Wallet transactions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       type:
 *                         type: string
 *                         enum: [deposit, withdrawal, payment, refund]
 *                       amount:
 *                         type: number
 *                       description:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
router.get('/wallet/transactions', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(String(req.query.page || 1));
    const limit = Math.min(parseInt(String(req.query.limit || 20)), 100);
    const offset = (page - 1) * limit;

    // In a real implementation, you would have a separate WalletTransaction model
    // For now, we'll return a mock response
    const mockTransactions = [
      {
        id: '1',
        type: 'deposit',
        amount: 100000,
        description: 'Пополнение кошелька',
        createdAt: new Date().toISOString()
      }
    ];

    res.json({
      success: true,
      data: mockTransactions,
      pagination: {
        page,
        limit,
        total: mockTransactions.length,
        totalPages: 1
      }
    });
  } catch (error) {
    logger.error('Get wallet transactions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load transactions'
    });
  }
});

/**
 * @swagger
 * /api/v1/users/notifications:
 *   get:
 *     summary: Get user notifications
 *     tags: [Users]
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
 *         name: unread
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Notifications retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       title:
 *                         type: string
 *                       body:
 *                         type: string
 *                       type:
 *                         type: string
 *                       read:
 *                         type: boolean
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
router.get('/notifications', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(String(req.query.page || 1));
    const limit = Math.min(parseInt(String(req.query.limit || 20)), 100);
    const offset = (page - 1) * limit;
    const unread = req.query.unread === 'true';

    // In a real implementation, you would query the notifications table
    // For now, we'll return a mock response
    const mockNotifications = [
      {
        id: '1',
        title: 'Заказ доставлен',
        body: 'Ваш заказ #12345 успешно доставлен',
        type: 'order_update',
        read: false,
        createdAt: new Date().toISOString()
      }
    ];

    res.json({
      success: true,
      data: mockNotifications,
      pagination: {
        page,
        limit,
        total: mockNotifications.length,
        totalPages: 1
      }
    });
  } catch (error) {
    logger.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load notifications'
    });
  }
});

/**
 * @swagger
 * /api/v1/users/notifications/{notificationId}/read:
 *   post:
 *     summary: Mark notification as read
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 */
router.post('/notifications/:notificationId/read', authenticateToken, async (req, res) => {
  try {
    const { notificationId } = req.params;

    // In a real implementation, you would update the notification in the database
    // For now, we'll just return success

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    logger.error('Mark notification read error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read'
    });
  }
});

module.exports = router;

