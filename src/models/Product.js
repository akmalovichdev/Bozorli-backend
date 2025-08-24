const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * @swagger
 * components:
 *   schemas:
 *     Product:
 *       type: object
 *       required:
 *         - name
 *         - price
 *         - storeId
 *       properties:
 *         id:
 *           type: string
 *           description: Unique identifier for the product
 *         name:
 *           type: string
 *           description: Product name
 *         description:
 *           type: string
 *           description: Product description
 *         price:
 *           type: number
 *           description: Product price
 *         sku:
 *           type: string
 *           description: Stock keeping unit
 *         storeId:
 *           type: string
 *           description: ID of the store that sells this product
 *         category:
 *           type: string
 *           description: Product category
 *         unit:
 *           type: string
 *           description: Unit of measurement (шт, кг, л, etc.)
 *         images:
 *           type: array
 *           items:
 *             type: string
 *           description: Array of image URLs
 *         attributes:
 *           type: object
 *           description: Additional product attributes
 *         inStock:
 *           type: boolean
 *           description: Whether the product is in stock
 *         quantity:
 *           type: number
 *           description: Available quantity
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [2, 200]
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0
    }
  },
  sku: {
    type: DataTypes.STRING(50),
    allowNull: true,
    unique: true
  },
  store_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'stores',
      key: 'id'
    }
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: false,
    defaultValue: 'Other'
  },
  unit: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'шт'
  },
  images: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: []
  },
  attributes: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {}
  },
  in_stock: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  reserved_quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  // Product status
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  is_featured: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  // SEO and search
  tags: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: []
  },
  search_keywords: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Pricing
  original_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  discount_percentage: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0.00,
    validate: {
      min: 0,
      max: 100
    }
  },
  // Dimensions and weight
  weight: {
    type: DataTypes.DECIMAL(8, 3), // in kg
    allowNull: true
  },
  dimensions: {
    type: DataTypes.JSON, // {length, width, height}
    allowNull: true
  },
  // Nutritional information (for food products)
  nutritional_info: {
    type: DataTypes.JSON,
    allowNull: true
  },
  // Expiry and manufacturing
  expiry_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  manufacturing_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // Allergens and dietary info
  allergens: {
    type: DataTypes.JSON,
    allowNull: true
  },
  dietary_info: {
    type: DataTypes.JSON, // {vegetarian, vegan, glutenFree, etc.}
    allowNull: true
  }
}, {
  tableName: 'products',
  timestamps: true,
  indexes: [
    {
      fields: ['store_id']
    },
    {
      fields: ['category']
    },
    {
      fields: ['in_stock']
    },
    {
      fields: ['is_active']
    },
    {
      fields: ['is_featured']
    },
    {
      fields: ['sku'],
      unique: true
    },
    {
      type: 'FULLTEXT',
      fields: ['name', 'description', 'search_keywords']
    }
  ]
});

// Instance methods
Product.prototype.getAvailableQuantity = function() {
  return Math.max(0, this.quantity - this.reserved_quantity);
};

Product.prototype.canReserve = function(amount) {
  return this.getAvailableQuantity() >= amount;
};

Product.prototype.reserve = function(amount) {
  if (!this.canReserve(amount)) {
    throw new Error('Insufficient stock');
  }
  this.reservedQuantity += amount;
  return this.save();
};

Product.prototype.releaseReservation = function(amount) {
  this.reservedQuantity = Math.max(0, this.reservedQuantity - amount);
  return this.save();
};

Product.prototype.getFinalPrice = function() {
  if (this.discountPercentage > 0) {
    return this.price * (1 - this.discountPercentage / 100);
  }
  return this.price;
};

// Class methods
Product.findByStore = function(storeId, options = {}) {
  return this.findAll({
    where: { 
      store_id: storeId, 
      isActive: true,
      ...options.where 
    },
    ...options
  });
};

Product.findByCategory = function(category, options = {}) {
  return this.findAll({
    where: { 
      category, 
      isActive: true,
      inStock: true,
      ...options.where 
    },
    ...options
  });
};

Product.search = function(query, options = {}) {
  return this.findAll({
    where: {
      isActive: true,
      inStock: true,
      [Op.or]: [
        {
          name: {
            [Op.like]: `%${query}%`
          }
        },
        {
          description: {
            [Op.like]: `%${query}%`
          }
        },
        {
          searchKeywords: {
            [Op.like]: `%${query}%`
          }
        }
      ]
    },
    ...options
  });
};

Product.findFeatured = function(options = {}) {
  return this.findAll({
    where: { 
      isFeatured: true, 
      isActive: true,
      inStock: true,
      ...options.where 
    },
    ...options
  });
};

Product.findLowStock = function(threshold = 10, options = {}) {
  return this.findAll({
    where: {
      quantity: {
        [Op.lte]: threshold
      },
      isActive: true,
      ...options.where
    },
    ...options
  });
};

module.exports = Product;
