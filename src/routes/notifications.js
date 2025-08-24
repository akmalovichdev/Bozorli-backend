const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * /api/v1/notifications:
 *   get:
 *     summary: Get user notifications
 *     tags: [Notifications]
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
 *         name: read
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [order_update, payment, promo, system]
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
 *                     $ref: '#/components/schemas/Notification'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(String(req.query.page || 1));
    const limit = Math.min(parseInt(String(req.query.limit || 20)), 100);
    const offset = (page - 1) * limit;
    const read = req.query.read !== undefined ? req.query.read === 'true' : undefined;
    const type = req.query.type ? String(req.query.type) : undefined;

    // Mock notifications for now - in real app would use Notification model
    const mockNotifications = [
      {
        id: '1',
        user_id: req.user.id,
        title: 'Заказ подтвержден',
        body: 'Ваш заказ #12345 подтвержден магазином',
        type: 'order_update',
        data: { orderId: '12345', status: 'confirmed' },
        read: false,
        createdAt: new Date().toISOString()
      },
      {
        id: '2',
        user_id: req.user.id,
        title: 'Курьер назначен',
        body: 'Курьер Ахмад назначен для доставки заказа #12345',
        type: 'order_update',
        data: { orderId: '12345', courierId: 'courier-1' },
        read: false,
        createdAt: new Date(Date.now() - 300000).toISOString()
      }
    ];

    let filteredNotifications = mockNotifications;
    
    if (read !== undefined) {
      filteredNotifications = filteredNotifications.filter(n => n.read === read);
    }
    
    if (type) {
      filteredNotifications = filteredNotifications.filter(n => n.type === type);
    }

    const total = filteredNotifications.length;
    const paginatedNotifications = filteredNotifications.slice(offset, offset + limit);

    res.json({
      success: true,
      data: paginatedNotifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Get notifications error:', error);
    res.status(500).json({ success: false, error: 'Failed to get notifications' });
  }
});

/**
 * @swagger
 * /api/v1/notifications/{notificationId}/read:
 *   post:
 *     summary: Mark notification as read
 *     tags: [Notifications]
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
router.post('/:notificationId/read', authenticateToken, async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    // In real app would update Notification model
    logger.info(`Marking notification ${notificationId} as read for user ${req.user.id}`);
    
    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    logger.error('Mark notification read error:', error);
    res.status(500).json({ success: false, error: 'Failed to mark notification as read' });
  }
});

/**
 * @swagger
 * /api/v1/notifications/read-all:
 *   post:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
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
router.post('/read-all', authenticateToken, async (req, res) => {
  try {
    // In real app would update Notification model
    logger.info(`Marking all notifications as read for user ${req.user.id}`);
    
    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    logger.error('Mark all notifications read error:', error);
    res.status(500).json({ success: false, error: 'Failed to mark notifications as read' });
  }
});

/**
 * @swagger
 * /api/v1/notifications/settings:
 *   get:
 *     summary: Get notification settings
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notification settings retrieved successfully
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
 *                     orderUpdates:
 *                       type: boolean
 *                     promotions:
 *                       type: boolean
 *                     systemMessages:
 *                       type: boolean
 *                     pushEnabled:
 *                       type: boolean
 *                     emailEnabled:
 *                       type: boolean
 */
router.get('/settings', authenticateToken, async (req, res) => {
  try {
    // Mock settings - in real app would use UserSettings model
    const settings = {
      orderUpdates: true,
      promotions: true,
      systemMessages: true,
      pushEnabled: true,
      emailEnabled: false
    };
    
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    logger.error('Get notification settings error:', error);
    res.status(500).json({ success: false, error: 'Failed to get notification settings' });
  }
});

/**
 * @swagger
 * /api/v1/notifications/settings:
 *   put:
 *     summary: Update notification settings
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               orderUpdates:
 *                 type: boolean
 *               promotions:
 *                 type: boolean
 *               systemMessages:
 *                 type: boolean
 *               pushEnabled:
 *                 type: boolean
 *               emailEnabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Settings updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 */
router.put('/settings', 
  authenticateToken,
  [
    body('orderUpdates').optional().isBoolean(),
    body('promotions').optional().isBoolean(),
    body('systemMessages').optional().isBoolean(),
    body('pushEnabled').optional().isBoolean(),
    body('emailEnabled').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ 
          success: false, 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }

      // In real app would update UserSettings model
      logger.info(`Updating notification settings for user ${req.user.id}:`, req.body);
      
      res.json({
        success: true,
        data: req.body
      });
    } catch (error) {
      logger.error('Update notification settings error:', error);
      res.status(500).json({ success: false, error: 'Failed to update settings' });
    }
  }
);

module.exports = router;

