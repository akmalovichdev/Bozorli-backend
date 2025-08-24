const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireRole } = require('../middleware/auth');
const Courier = require('../models/Courier');
const User = require('../models/User');
const Order = require('../models/Order');
const logger = require('../utils/logger');
const { literal } = require('sequelize');

const router = express.Router();

/**
 * @swagger
 * /api/v1/couriers/nearby:
 *   get:
 *     summary: Get nearby available couriers
 *     tags: [Couriers]
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: lng
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *           default: 5000
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Nearby couriers retrieved successfully
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
 *                     $ref: '#/components/schemas/Courier'
 */
router.get('/nearby', async (req, res) => {
  try {
    const lat = parseFloat(String(req.query.lat));
    const lng = parseFloat(String(req.query.lng));
    const radius = parseInt(String(req.query.radius || 5000));
    const limit = Math.min(parseInt(String(req.query.limit || 10)), 50);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ success: false, error: 'lat and lng are required' });
    }

    const couriers = await Courier.findAll({
      where: { status: 'idle' },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'full_name', 'phone', 'avatar']
        }
      ],
      attributes: {
        include: [
          [
            literal(`ST_Distance_Sphere(POINT(${lng}, ${lat}), current_location)`),
            'distance'
          ]
        ]
      },
      having: literal(`distance <= ${radius}`),
      order: literal('distance ASC'),
      limit
    });

    const data = couriers.map(courier => ({
      id: courier.id,
      userId: courier.userId,
      user: courier.user,
      vehicleInfo: courier.vehicle_info,
      status: courier.status,
      currentLocation: courier.current_location ? {
        latitude: courier.current_location.coordinates[1],
        longitude: courier.current_location.coordinates[0]
      } : null,
      lastSeen: courier.last_seen,
      distance: courier.get('distance') ? Number(courier.get('distance')) : undefined
    }));

    res.json({
      success: true,
      data
    });
  } catch (error) {
    logger.error('Get nearby couriers error:', error);
    res.status(500).json({ success: false, error: 'Failed to get nearby couriers' });
  }
});

/**
 * @swagger
 * /api/v1/couriers/{courierId}/location:
 *   put:
 *     summary: Update courier location
 *     tags: [Couriers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courierId
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
 *               - latitude
 *               - longitude
 *             properties:
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *     responses:
 *       200:
 *         description: Location updated successfully
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
router.put('/:courierId/location',
  authenticateToken,
  requireRole('courier'),
  [
    body('latitude').isFloat({ min: -90, max: 90 }),
    body('longitude').isFloat({ min: -180, max: 180 })
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

      const { courierId } = req.params;
      const { latitude, longitude } = req.body;

      // Verify courier owns this record
      const courier = await Courier.findOne({
        where: { id: courierId, userId: req.user.id }
      });

      if (!courier) {
        return res.status(404).json({ success: false, error: 'Courier not found' });
      }

      courier.current_location = { type: 'Point', coordinates: [longitude, latitude] };
      courier.last_seen = new Date();
      await courier.save();

      // Emit WebSocket event for real-time tracking
      const io = req.app.get('io');
      if (io) {
        io.emit('courier_location_update', {
          courierId: courier.id,
          location: { latitude, longitude },
          timestamp: courier.lastSeen
        });
      }

      res.json({
        success: true,
        message: 'Location updated successfully'
      });
    } catch (error) {
      logger.error('Update courier location error:', error);
      res.status(500).json({ success: false, error: 'Failed to update location' });
    }
  }
);

/**
 * @swagger
 * /api/v1/couriers/{courierId}/status:
 *   put:
 *     summary: Update courier status
 *     tags: [Couriers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courierId
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
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [offline, idle, busy, suspended]
 *     responses:
 *       200:
 *         description: Status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Courier'
 */
router.put('/:courierId/status',
  authenticateToken,
  requireRole('courier'),
  [
    body('status').isIn(['offline', 'idle', 'busy', 'suspended'])
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

      const { courierId } = req.params;
      const { status } = req.body;

      const courier = await Courier.findOne({
        where: { id: courierId, userId: req.user.id }
      });

      if (!courier) {
        return res.status(404).json({ success: false, error: 'Courier not found' });
      }

      courier.status = status;
      courier.lastSeen = new Date();
      await courier.save();

      res.json({
        success: true,
        data: courier
      });
    } catch (error) {
      logger.error('Update courier status error:', error);
      res.status(500).json({ success: false, error: 'Failed to update status' });
    }
  }
);

/**
 * @swagger
 * /api/v1/couriers/{courierId}/orders:
 *   get:
 *     summary: Get courier's current orders
 *     tags: [Couriers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courierId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [en_route_to_store, at_store, picking, en_route_to_customer, delivered]
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
 */
router.get('/:courierId/orders',
  authenticateToken,
  requireRole('courier'),
  async (req, res) => {
    try {
      const { courierId } = req.params;
      const status = req.query.status ? String(req.query.status) : undefined;

      // Verify courier owns this record
      const courier = await Courier.findOne({
        where: { id: courierId, userId: req.user.id }
      });

      if (!courier) {
        return res.status(404).json({ success: false, error: 'Courier not found' });
      }

      const where = { assignedCourierId: req.user.id };
      if (status) {
        where.status = status;
      }

      const orders = await Order.findAll({
        where,
        include: [
          {
            model: User.sequelize.models.Store,
            as: 'store',
            attributes: ['id', 'name', 'address', 'location']
          },
          {
            model: User,
            as: 'customer',
            attributes: ['id', 'full_name', 'phone']
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      res.json({
        success: true,
        data: orders
      });
    } catch (error) {
      logger.error('Get courier orders error:', error);
      res.status(500).json({ success: false, error: 'Failed to get orders' });
    }
  }
);

/**
 * @swagger
 * /api/v1/couriers/{courierId}/profile:
 *   get:
 *     summary: Get courier profile
 *     tags: [Couriers]
 *     parameters:
 *       - in: path
 *         name: courierId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Courier profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Courier'
 */
router.get('/:courierId/profile', async (req, res) => {
  try {
    const { courierId } = req.params;

    const courier = await Courier.findByPk(courierId, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'full_name', 'phone', 'avatar', 'rating']
        }
      ]
    });

    if (!courier) {
      return res.status(404).json({ success: false, error: 'Courier not found' });
    }

    const data = {
      id: courier.id,
      userId: courier.userId,
      user: courier.user,
              vehicleInfo: courier.vehicle_info,
      status: courier.status,
      currentLocation: courier.currentLocation ? {
        latitude: courier.currentLocation.coordinates[1],
        longitude: courier.currentLocation.coordinates[0]
      } : null,
      lastSeen: courier.lastSeen
    };

    res.json({
      success: true,
      data
    });
  } catch (error) {
    logger.error('Get courier profile error:', error);
    res.status(500).json({ success: false, error: 'Failed to get courier profile' });
  }
});

module.exports = router;

