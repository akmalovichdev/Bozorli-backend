const express = require('express');
const { Op, literal } = require('sequelize');
const { optionalAuth } = require('../middleware/auth');
const Product = require('../models/Product');
const Store = require('../models/Store');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * /api/v1/products/search:
 *   get:
 *     summary: Search products across all stores
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
 *       - in: query
 *         name: lat
 *         schema:
 *           type: number
 *         description: Latitude for distance calculation
 *       - in: query
 *         name: lng
 *         schema:
 *           type: number
 *         description: Longitude for distance calculation
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *           default: 10000
 *         description: Search radius in meters
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
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
 *         description: Products found successfully
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
 *                       name:
 *                         type: string
 *                       price:
 *                         type: number
 *                       store:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           distance:
 *                             type: number
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
router.get('/search', optionalAuth, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const lat = req.query.lat ? parseFloat(String(req.query.lat)) : undefined;
    const lng = req.query.lng ? parseFloat(String(req.query.lng)) : undefined;
    const radius = parseInt(String(req.query.radius || 10000));
    const category = req.query.category ? String(req.query.category) : undefined;
    const minPrice = req.query.minPrice ? parseFloat(String(req.query.minPrice)) : undefined;
    const maxPrice = req.query.maxPrice ? parseFloat(String(req.query.maxPrice)) : undefined;
    const inStock = req.query.inStock === 'true';
    const page = parseInt(String(req.query.page || 1));
    const limit = Math.min(parseInt(String(req.query.limit || 20)), 100);
    const offset = (page - 1) * limit;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    const productWhere = {
      is_active: true,
      [Op.or]: [
        { name: { [Op.like]: `%${q}%` } },
        { description: { [Op.like]: `%${q}%` } },
        { sku: { [Op.like]: `%${q}%` } }
      ]
    };

    if (category) {
      productWhere.category = category;
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      productWhere.price = {};
      if (minPrice !== undefined) productWhere.price[Op.gte] = minPrice;
      if (maxPrice !== undefined) productWhere.price[Op.lte] = maxPrice;
    }

    if (inStock) {
      productWhere.in_stock = true;
    }

    const storeWhere = { status: 'open' };
    const storeAttributes = ['id', 'name', 'address'];

    // Add distance calculation if coordinates provided
    if (lat && lng && !Number.isNaN(lat) && !Number.isNaN(lng)) {
      storeAttributes.push([
        literal(`ST_Distance_Sphere(POINT(${lng}, ${lat}), location)`),
        'distance'
      ]);
      storeWhere[Op.and] = [
        literal(`ST_Distance_Sphere(POINT(${lng}, ${lat}), location) <= ${radius}`)
      ];
    }

    const { rows, count } = await Product.findAndCountAll({
      where: productWhere,
      include: [
        {
          model: Store,
          as: 'store',
          where: storeWhere,
          attributes: storeAttributes,
          required: true
        }
      ],
      offset,
      limit,
      order: [
        ['is_featured', 'DESC'],
        lat && lng ? [literal('store.distance ASC')] : ['createdAt', 'DESC']
      ]
    });

    const data = rows.map((product) => ({
      id: product.id,
      storeId: product.storeId,
      sku: product.sku,
      name: product.name,
      description: product.description,
      price: Number(product.price),
      unit: product.unit,
      images: product.images || [],
      attributes: product.attributes || {},
      category: product.category,
      inStock: Boolean(product.in_stock),
      store: {
        id: product.store.id,
        name: product.store.name,
        address: product.store.address,
        distance: product.store.get('distance') ? Number(product.store.get('distance')) : undefined
      }
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
    logger.error('Product search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search products'
    });
  }
});

/**
 * @swagger
 * /api/v1/products/categories:
 *   get:
 *     summary: Get all product categories
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
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
router.get('/categories', async (req, res) => {
  try {
    const categories = await Product.findAll({
      attributes: [[literal('DISTINCT category'), 'category']],
      where: { is_active: true },
      raw: true
    });

    const categoryList = categories
      .map(c => c.category)
      .filter(Boolean)
      .sort();

    res.json({
      success: true,
      data: categoryList
    });
  } catch (error) {
    logger.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get categories'
    });
  }
});

/**
 * @swagger
 * /api/v1/products/{productId}:
 *   get:
 *     summary: Get product details
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Product'
 *       404:
 *         description: Product not found
 */
router.get('/:productId', optionalAuth, async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findOne({
      where: { id: productId, is_active: true },
      include: [
        {
          model: Store,
          as: 'store',
          attributes: ['id', 'name', 'address', 'status', 'rating']
        }
      ]
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    const data = {
      id: product.id,
      storeId: product.storeId,
      sku: product.sku,
      name: product.name,
      description: product.description,
      price: Number(product.price),
      unit: product.unit,
      images: product.images || [],
      attributes: product.attributes || {},
      category: product.category,
      inStock: Boolean(product.in_stock),
      store: {
        id: product.store.id,
        name: product.store.name,
        address: product.store.address,
        status: product.store.status,
        rating: Number(product.store.rating)
      }
    };

    res.json({
      success: true,
      data
    });
  } catch (error) {
    logger.error('Get product details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get product details'
    });
  }
});

/**
 * @swagger
 * /api/v1/products/featured:
 *   get:
 *     summary: Get featured products
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Featured products retrieved successfully
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
 */
router.get('/featured', async (req, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || 10)), 50);

    const products = await Product.findAll({
      where: { 
        is_active: true, 
        is_featured: true 
      },
      include: [
        {
          model: Store,
          as: 'store',
          attributes: ['id', 'name', 'address', 'status'],
          where: { status: 'open' }
        }
      ],
      limit,
      order: [['createdAt', 'DESC']]
    });

    const data = products.map(product => ({
      id: product.id,
      storeId: product.storeId,
      sku: product.sku,
      name: product.name,
      description: product.description,
      price: Number(product.price),
      unit: product.unit,
      images: product.images || [],
      attributes: product.attributes || {},
      category: product.category,
      inStock: Boolean(product.in_stock),
      store: product.store
    }));

    res.json({
      success: true,
      data
    });
  } catch (error) {
    logger.error('Get featured products error:', error);
    res.status(500).json({ success: false, error: 'Failed to get featured products' });
  }
});

module.exports = router;

