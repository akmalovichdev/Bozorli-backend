const express = require('express');
const { Op, literal } = require('sequelize');
const { optionalAuth } = require('../middleware/auth');
const Store = require('../models/Store');
const Product = require('../models/Product');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * /api/v1/stores/nearby:
 *   get:
 *     summary: Get nearby stores
 *     tags: [Stores]
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         schema:
 *           type: number
 *         description: Latitude coordinate
 *       - in: query
 *         name: lng
 *         required: true
 *         schema:
 *           type: number
 *         description: Longitude coordinate
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *           default: 5000
 *         description: Search radius in meters
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
 *         description: Nearby stores retrieved successfully
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
 *                     $ref: '#/components/schemas/Store'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       400:
 *         description: Invalid coordinates
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: lat and lng are required
 */
router.get('/nearby', optionalAuth, async (req, res) => {
  try {
    const lat = parseFloat(String(req.query.lat));
    const lng = parseFloat(String(req.query.lng));
    const radius = parseInt(String(req.query.radius || 5000));
    const page = parseInt(String(req.query.page || 1));
    const limit = Math.min(parseInt(String(req.query.limit || 20)), 100);
    const offset = (page - 1) * limit;

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ success: false, error: 'lat and lng are required' });
    }

    // Find nearby open stores with distance
    const stores = await Store.findAll({
      where: { status: 'open' },
      attributes: {
        include: [
          [
            literal(`ST_Distance_Sphere(POINT(${lng}, ${lat}), location)`),
            'distance'
          ]
        ]
      },
      having: literal(`distance <= ${radius}`),
      order: literal('distance ASC'),
      offset,
      limit
    });

    // Count total within radius (approximate - we can run a separate count query)
    // For simplicity, reuse same query without offset/limit
    const allStores = await Store.findAll({
      where: { status: 'open' },
      attributes: {
        include: [
          [
            literal(`ST_Distance_Sphere(POINT(${lng}, ${lat}), location)`),
            'distance'
          ]
        ]
      },
      having: literal(`distance <= ${radius}`)
    });

    const data = stores.map((s) => ({
      id: s.id,
      ownerId: s.ownerId,
      name: s.name,
      address: s.address,
      location: s.location ? { latitude: s.location.coordinates[1], longitude: s.location.coordinates[0] } : null,
      openHours: s.openHours,
      status: s.status,
      rating: Number(s.rating),
      distance: s.get('distance') ? Number(s.get('distance')) : undefined
    }));

    res.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total: allStores.length,
        totalPages: Math.ceil(allStores.length / limit)
      }
    });
  } catch (error) {
    logger.error('Nearby stores error:', error);
    res.status(500).json({ success: false, error: 'Failed to load nearby stores' });
  }
});

/**
 * @swagger
 * /api/v1/stores/{storeId}/catalog:
 *   get:
 *     summary: Get store catalog
 *     tags: [Stores]
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: string
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
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query for products
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by product category
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Minimum price filter
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Maximum price filter
 *       - in: query
 *         name: inStock
 *         schema:
 *           type: boolean
 *         description: Filter by stock availability
 *     responses:
 *       200:
 *         description: Store catalog retrieved successfully
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
 *                     $ref: '#/components/schemas/Product'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
router.get('/:storeId/catalog', optionalAuth, async (req, res) => {
  try {
    const { storeId } = req.params;
    const page = parseInt(String(req.query.page || 1));
    const limit = Math.min(parseInt(String(req.query.limit || 20)), 100);
    const offset = (page - 1) * limit;
    const q = String(req.query.q || '').trim();
    const category = req.query.category ? String(req.query.category) : undefined;
    const minPrice = req.query.minPrice ? parseFloat(String(req.query.minPrice)) : undefined;
    const maxPrice = req.query.maxPrice ? parseFloat(String(req.query.maxPrice)) : undefined;
    const inStock = req.query.inStock === 'true';

          const where = { storeId, is_active: true };

    if (q) {
      where[Op.or] = [
        { name: { [Op.like]: `%${q}%` } },
        { description: { [Op.like]: `%${q}%` } }
      ];
    }

    if (category) {
      where.category = category;
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price[Op.gte] = minPrice;
      if (maxPrice !== undefined) where.price[Op.lte] = maxPrice;
    }

    if (inStock) {
      where.inStock = true;
    }

    const findOptions = {
      where,
      offset,
      limit,
      order: [['isFeatured', 'DESC'], ['createdAt', 'DESC']]
    };

    const { rows, count } = await Product.findAndCountAll(findOptions);

    const data = rows.map((p) => ({
      id: p.id,
      storeId: p.storeId,
      sku: p.sku,
      name: p.name,
      description: p.description,
      price: Number(p.price),
      unit: p.unit,
      images: p.images || [],
      attributes: p.attributes || {},
      category: p.category,
      inStock: Boolean(p.inStock)
    }));

    res.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    logger.error('Store catalog error:', error);
    res.status(500).json({ success: false, error: 'Failed to load catalog' });
  }
});

/**
 * @swagger
 * /api/v1/stores/{storeId}:
 *   get:
 *     summary: Get store details
 *     tags: [Stores]
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Store details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Store'
 *       404:
 *         description: Store not found
 */
router.get('/:storeId', optionalAuth, async (req, res) => {
  try {
    const { storeId } = req.params;

    const store = await Store.findByPk(storeId, {
      include: [
        {
          model: Store.sequelize.models.User,
          as: 'owner',
          attributes: ['id', 'full_name', 'phone']
        }
      ]
    });

    if (!store) {
      return res.status(404).json({ success: false, error: 'Store not found' });
    }

    const data = {
      id: store.id,
      ownerId: store.ownerId,
      name: store.name,
      description: store.description,
      address: store.address,
      location: store.location ? {
        latitude: store.location.coordinates[1],
        longitude: store.location.coordinates[0]
      } : null,
      status: store.status,
      rating: Number(store.rating),
      totalRatings: store.totalRatings,
      openHours: store.openHours,
      minimumOrderAmount: Number(store.minimumOrderAmount),
      deliveryRadius: store.deliveryRadius,
      preparationTime: store.preparationTime,
      logo: store.logo,
      banner: store.banner,
      contactPhone: store.contactPhone,
      contactEmail: store.contactEmail,
      owner: store.owner
    };

    res.json({
      success: true,
      data
    });
  } catch (error) {
    logger.error('Get store details error:', error);
    res.status(500).json({ success: false, error: 'Failed to get store details' });
  }
});

/**
 * @swagger
 * /api/v1/stores/{storeId}/categories:
 *   get:
 *     summary: Get store product categories
 *     tags: [Stores]
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Store categories retrieved successfully
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
 *                     type: string
 */
router.get('/:storeId/categories', async (req, res) => {
  try {
    const { storeId } = req.params;

    const categories = await Product.findAll({
      attributes: [[literal('DISTINCT category'), 'category']],
              where: { storeId, is_active: true },
      raw: true
    });

    const categoryList = categories.map(c => c.category).filter(Boolean);

    res.json({
      success: true,
      data: categoryList
    });
  } catch (error) {
    logger.error('Get store categories error:', error);
    res.status(500).json({ success: false, error: 'Failed to get categories' });
  }
});

module.exports = router;

