const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Store = require('../models/Store');
const Inventory = require('../models/Inventory');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * /api/v1/orders:
 *   get:
 *     summary: Get user orders
 *     tags: [Orders]
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
 *         description: Orders retrieved successfully
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
router.get('/', authenticateToken, async (req, res) => {
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
          attributes: ['id', 'name', 'address']
        },
        {
          model: Order.sequelize.models.User,
          as: 'courier',
          attributes: ['id', 'full_name', 'phone']
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
    logger.error('List orders error:', error);
    res.status(500).json({ success: false, error: 'Failed to load orders' });
  }
});

/**
 * @swagger
 * /api/v1/orders:
 *   post:
 *     summary: Create new order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *               - storeId
 *               - deliveryAddress
 *               - paymentMethod
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productId:
 *                       type: string
 *                     qty:
 *                       type: integer
 *                     note:
 *                       type: string
 *               storeId:
 *                 type: string
 *               deliveryAddress:
 *                 type: object
 *                 properties:
 *                   latitude:
 *                     type: number
 *                   longitude:
 *                     type: number
 *                   text:
 *                     type: string
 *               paymentMethod:
 *                 type: string
 *                 enum: [card, cash, wallet]
 *               idempotency_key:
 *                 type: string
 *               customerNotes:
 *                 type: string
 *               deliveryInstructions:
 *                 type: string
 *     responses:
 *       201:
 *         description: Order created successfully
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
 *                     orderId:
 *                       type: string
 *                     status:
 *                       type: string
 *       400:
 *         description: Validation error or insufficient stock
 *       422:
 *         description: Validation failed
 */
router.post(
  '/',
  authenticateToken,
  [
    body('items').isArray({ min: 1 }),
    body('storeId').isString().notEmpty(),
    body('deliveryAddress').isObject(),
    body('paymentMethod').isIn(['card', 'cash', 'wallet']),
    body('idempotency_key').optional().isString()
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

      const { items, storeId, deliveryAddress, paymentMethod, customerNotes, deliveryInstructions } = req.body;
      const idempotencyKey = req.body.idempotency_key || uuidv4();

      // Check if idempotent order exists
      const existing = await Order.findOne({ where: { idempotencyKey } });
      if (existing) {
        return res.json({ success: true, data: { orderId: existing.id, status: existing.status } });
      }

      // Validate store
      const store = await Store.findByPk(storeId);
      if (!store || store.status !== 'open') {
        return res.status(400).json({ success: false, error: 'Store not available' });
      }

      // Load products and compute totals
      const productIds = items.map((i) => i.productId);
      const products = await Product.findAll({ where: { id: productIds, storeId, is_active: true } });
      if (products.length !== items.length) {
        return res.status(400).json({ success: false, error: 'Some products are not available' });
      }

      // Reserve stock (simple approach)
      for (const item of items) {
        const product = products.find((p) => p.id === item.productId);
        if (!product || !product.canReserve(item.qty)) {
          return res.status(400).json({ success: false, error: `Insufficient stock for ${item.productId}` });
        }
      }

      // Apply reservations
      for (const item of items) {
        const product = products.find((p) => p.id === item.productId);
        await product.reserve(item.qty);
      }

      const subtotal = items.reduce((sum, item) => {
        const product = products.find((p) => p.id === item.productId);
        return sum + Number(product.getFinalPrice()) * item.qty;
      }, 0);

      const deliveryFee = 0; // compute later by distance
      const totalAmount = subtotal + deliveryFee;

      const order = await Order.create({
        user_id: req.user.id,
        storeId,
        totalAmount,
        subtotalAmount: subtotal,
        deliveryFee,
        paymentMethod,
        status: paymentMethod === 'cash' ? 'confirmed' : 'payment_pending',
        deliveryAddress,
        idempotencyKey,
        items: items.map((i) => ({ ...i })),
        customerNotes,
        deliveryInstructions
      });

      // Emit WS event if needed
      const io = req.app.get('io');
      if (io) io.emit('order-created', { orderId: order.id, status: order.status });

      res.status(201).json({ success: true, data: { orderId: order.id, status: order.status } });
    } catch (error) {
      logger.error('Create order error:', error);
      res.status(500).json({ success: false, error: 'Failed to create order' });
    }
  }
);

/**
 * @swagger
 * /api/v1/orders/{orderId}:
 *   get:
 *     summary: Get order details
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Order details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Order'
 *       404:
 *         description: Order not found
 */
router.get('/:orderId', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await Order.findOne({
      where: { id: orderId, user_id: req.user.id },
      include: [
        {
          model: Store,
          as: 'store',
          attributes: ['id', 'name', 'address', 'location', 'contactPhone']
        },
        {
          model: Order.sequelize.models.User,
          as: 'courier',
          attributes: ['id', 'full_name', 'phone', 'avatar']
        }
      ]
    });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    logger.error('Get order details error:', error);
    res.status(500).json({ success: false, error: 'Failed to get order details' });
  }
});

/**
 * @swagger
 * /api/v1/orders/{orderId}/status:
 *   get:
 *     summary: Get order status
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Order status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Order'
 *       404:
 *         description: Order not found
 */
router.get('/:orderId/status', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findByPk(orderId, { 
      where: { user_id: req.user.id },
      include: ['store', 'courier'] 
    });
    if (!order || order.user_id !== req.user.id) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    res.json({ success: true, data: order });
  } catch (error) {
    logger.error('Get order status error:', error);
    res.status(500).json({ success: false, error: 'Failed to get order status' });
  }
});

/**
 * @swagger
 * /api/v1/orders/{orderId}/cancel:
 *   post:
 *     summary: Cancel order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Order cancelled successfully
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
 *                     message:
 *                       type: string
 *       400:
 *         description: Order cannot be cancelled
 *       404:
 *         description: Order not found
 */
router.post('/:orderId/cancel', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    
    const order = await Order.findByPk(orderId);
    if (!order || order.user_id !== req.user.id) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (!['created', 'payment_pending', 'confirmed', 'assigning'].includes(order.status)) {
      return res.status(400).json({ success: false, error: 'Order cannot be cancelled' });
    }

    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.cancelledBy = 'customer';
    order.cancellationReason = reason;
    await order.save();

    // Release reserved stock
    for (const item of order.items) {
      const product = await Product.findByPk(item.productId);
      if (product) await product.releaseReservation(item.quantity || item.qty || 0);
    }

    // Emit WebSocket event
    const io = req.app.get('io');
    if (io) {
      io.to(`order_${orderId}`).emit('order_update', {
        orderId: order.id,
        status: order.status,
        cancelledAt: order.cancelledAt
      });
    }

    res.json({ success: true, data: { message: 'Order cancelled' } });
  } catch (error) {
    logger.error('Cancel order error:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel order' });
  }
});

/**
 * @swagger
 * /api/v1/orders/{orderId}/rate:
 *   post:
 *     summary: Rate order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rating
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               feedback:
 *                 type: string
 *     responses:
 *       200:
 *         description: Order rated successfully
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
router.post('/:orderId/rate',
  authenticateToken,
  [
    body('rating').isInt({ min: 1, max: 5 }),
    body('feedback').optional().isString().trim()
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

      const { orderId } = req.params;
      const { rating, feedback } = req.body;

      const order = await Order.findOne({
        where: { id: orderId, user_id: req.user.id }
      });

      if (!order) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }

      if (order.status !== 'delivered' && order.status !== 'completed') {
        return res.status(400).json({ success: false, error: 'Order must be delivered to rate' });
      }

      order.customerRating = rating;
      order.customerFeedback = feedback;
      await order.save();

      res.json({
        success: true,
        message: 'Order rated successfully'
      });
    } catch (error) {
      logger.error('Rate order error:', error);
      res.status(500).json({ success: false, error: 'Failed to rate order' });
    }
  }
);

module.exports = router;

