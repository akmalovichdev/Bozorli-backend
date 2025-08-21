const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * @swagger
 * components:
 *   schemas:
 *     Store:
 *       type: object
 *       required:
 *         - name
 *         - address
 *         - ownerId
 *       properties:
 *         id:
 *           type: string
 *           description: Unique identifier for the store
 *         name:
 *           type: string
 *           description: Store name
 *         address:
 *           type: string
 *           description: Store address
 *         location:
 *           type: object
 *           properties:
 *             latitude:
 *               type: number
 *             longitude:
 *               type: number
 *         ownerId:
 *           type: string
 *           description: ID of the store owner
 *         status:
 *           type: string
 *           enum: [open, closed, temporarily_closed]
 *         rating:
 *           type: number
 *           minimum: 0
 *           maximum: 5
 *         openHours:
 *           type: object
 *           description: Store opening hours for each day
 *         minimumOrderAmount:
 *           type: number
 *           description: Minimum order amount
 *         deliveryRadius:
 *           type: number
 *           description: Delivery radius in meters
 *         preparationTime:
 *           type: number
 *           description: Average preparation time in minutes
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const Store = sequelize.define('Store', {
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
  address: {
    type: DataTypes.STRING(500),
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  location: {
    type: DataTypes.GEOMETRY('POINT'),
    allowNull: false
  },
  owner_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM('open', 'closed', 'temporarily_closed'),
    allowNull: false,
    defaultValue: 'open'
  },
  rating: {
    type: DataTypes.DECIMAL(2, 1),
    allowNull: false,
    defaultValue: 0.0,
    validate: {
      min: 0,
      max: 5
    }
  },
  totalRatings: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  openHours: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {
      monday: { open: '09:00', close: '21:00' },
      tuesday: { open: '09:00', close: '21:00' },
      wednesday: { open: '09:00', close: '21:00' },
      thursday: { open: '09:00', close: '21:00' },
      friday: { open: '09:00', close: '21:00' },
      saturday: { open: '09:00', close: '21:00' },
      sunday: { open: '09:00', close: '21:00' }
    }
  },
  minimumOrderAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  deliveryRadius: {
    type: DataTypes.INTEGER, // in meters
    allowNull: false,
    defaultValue: 5000
  },
  preparationTime: {
    type: DataTypes.INTEGER, // in minutes
    allowNull: false,
    defaultValue: 30
  },
  commissionRate: {
    type: DataTypes.DECIMAL(5, 2), // percentage
    allowNull: false,
    defaultValue: 10.00
  },
  logo: {
    type: DataTypes.STRING,
    allowNull: true
  },
  banner: {
    type: DataTypes.STRING,
    allowNull: true
  },
  contactPhone: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  contactEmail: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isEmail: true
    }
  },
  // Business information
  businessLicense: {
    type: DataTypes.STRING,
    allowNull: true
  },
  taxId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  bankAccount: {
    type: DataTypes.JSON,
    allowNull: true
  },
  // Settings
  autoAcceptOrders: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  notificationsEnabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  tableName: 'stores',
  timestamps: true,
  indexes: [
    {
      fields: ['owner_id']
    },
    {
      fields: ['status']
    },
    {
      fields: ['location'],
      type: 'SPATIAL'
    },
    {
      fields: ['rating']
    }
  ]
});

// Instance methods
Store.prototype.isOpen = function() {
  if (this.status !== 'open') return false;

  const now = new Date();
  const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const dayOfWeek = dayNames[now.getDay()];
  const currentTime = now.toTimeString().slice(0, 5);

  const todayHours = this.openHours?.[dayOfWeek];
  if (!todayHours || !todayHours.open || !todayHours.close) return false;

  return currentTime >= todayHours.open && currentTime <= todayHours.close;
};

Store.prototype.getDistance = function(lat, lng) {
  if (!this.location) return null;
  
  const R = 6371e3; // Earth's radius in meters
  const φ1 = this.location.coordinates[1] * Math.PI / 180;
  const φ2 = lat * Math.PI / 180;
  const Δφ = (lat - this.location.coordinates[1]) * Math.PI / 180;
  const Δλ = (lng - this.location.coordinates[0]) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
};

// Class methods
Store.findNearby = function(lat, lng, radius = 5000) {
  return this.findAll({
    where: {
      status: 'open'
    },
    attributes: {
      include: [
        [
          sequelize.literal(`
            ST_Distance_Sphere(
              POINT(${lng}, ${lat}),
              location
            )
          `),
          'distance'
        ]
      ]
    },
    having: sequelize.literal(`distance <= ${radius}`),
    order: sequelize.literal('distance ASC')
  });
};

Store.findByOwner = function(ownerId) {
  return this.findAll({ where: { ownerId } });
};

Store.findActive = function() {
  return this.findAll({ where: { status: 'open' } });
};

module.exports = Store;
