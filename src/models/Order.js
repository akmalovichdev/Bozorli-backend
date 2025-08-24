const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * @swagger
 * components:
 *   schemas:
 *     Order:
 *       type: object
 *       required:
 *         - userId
 *         - storeId
 *         - totalAmount
 *         - paymentMethod
 *       properties:
 *         id:
 *           type: string
 *           description: Unique identifier for the order
 *         userId:
 *           type: string
 *           description: ID of the customer
 *         storeId:
 *           type: string
 *           description: ID of the store
 *         totalAmount:
 *           type: number
 *           description: Total order amount
 *         paymentMethod:
 *           type: string
 *           enum: [card, cash, wallet]
 *           description: Payment method
 *         status:
 *           type: string
 *           enum: [created, payment_pending, confirmed, assigning, courier_assigned, en_route_to_store, at_store, picking, en_route_to_customer, delivered, completed, cancelled, refunded]
 *           description: Order status
 *         assignedCourierId:
 *           type: string
 *           description: ID of the assigned courier
 *         deliveryAddress:
 *           type: object
 *           properties:
 *             latitude:
 *               type: number
 *             longitude:
 *               type: number
 *             text:
 *               type: string
 *         estimatedDeliveryTime:
 *           type: string
 *           format: date-time
 *         idempotencyKey:
 *           type: string
 *           description: Unique key to prevent duplicate orders
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  store_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'stores',
      key: 'id'
    }
  },
  total_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0
    }
  },
  subtotal_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  delivery_fee: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  commission_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  payment_method: {
    type: DataTypes.ENUM('card', 'cash', 'wallet'),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM(
      'created',
      'payment_pending',
      'confirmed',
      'assigning',
      'courier_assigned',
      'en_route_to_store',
      'at_store',
      'picking',
      'en_route_to_customer',
      'delivered',
      'completed',
      'cancelled',
      'refunded'
    ),
    allowNull: false,
    defaultValue: 'created'
  },
  assigned_courier_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  delivery_address: {
    type: DataTypes.JSON,
    allowNull: false
  },
  estimated_delivery_time: {
    type: DataTypes.DATE,
    allowNull: true
  },
  actual_delivery_time: {
    type: DataTypes.DATE,
    allowNull: true
  },
  idempotency_key: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true
  },
  // Order details
  items: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: []
  },
  // Customer information
  customer_phone: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  customer_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  customer_notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Delivery information
  delivery_instructions: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Payment information
  payment_status: {
    type: DataTypes.ENUM('pending', 'paid', 'failed', 'refunded'),
    allowNull: false,
    defaultValue: 'pending'
  },
  payment_provider: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  payment_transaction_id: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  // Timestamps for different stages
  confirmed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  assigned_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  picked_up_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  delivered_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  cancelled_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // Cancellation information
  cancellation_reason: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  cancelled_by: {
    type: DataTypes.ENUM('customer', 'store', 'courier', 'admin'),
    allowNull: true
  },
  // Rating and feedback
  customer_rating: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 1,
      max: 5
    }
  },
  customer_feedback: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Internal notes
  internal_notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'orders',
  timestamps: true,
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['store_id']
    },
    {
      fields: ['assigned_courier_id']
    },
    {
      fields: ['status']
    },
    {
      fields: ['payment_status']
    },
    {
      fields: ['created_at']
    },
    {
      fields: ['idempotency_key'],
      unique: true
    }
  ]
});

// Instance methods
Order.prototype.canTransitionTo = function(newStatus) {
  const validTransitions = {
    created: ['payment_pending', 'cancelled'],
    payment_pending: ['confirmed', 'cancelled'],
    confirmed: ['assigning', 'cancelled'],
    assigning: ['courier_assigned', 'cancelled'],
    courier_assigned: ['en_route_to_store', 'cancelled'],
    en_route_to_store: ['at_store', 'cancelled'],
    at_store: ['picking', 'cancelled'],
    picking: ['en_route_to_customer', 'cancelled'],
    en_route_to_customer: ['delivered', 'cancelled'],
    delivered: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
    refunded: []
  };

  return validTransitions[this.status]?.includes(newStatus) || false;
};

Order.prototype.transitionTo = function(newStatus, additionalData = {}) {
  if (!this.canTransitionTo(newStatus)) {
    throw new Error(`Invalid status transition from ${this.status} to ${newStatus}`);
  }

  this.status = newStatus;

  // Set timestamps based on status
  switch (newStatus) {
    case 'confirmed':
      this.confirmedAt = new Date();
      break;
    case 'courier_assigned':
      this.assignedAt = new Date();
      break;
    case 'en_route_to_customer':
      this.pickedUpAt = new Date();
      break;
    case 'delivered':
      this.deliveredAt = new Date();
      this.actualDeliveryTime = new Date();
      break;
    case 'cancelled':
      this.cancelledAt = new Date();
      break;
  }

  // Update additional fields
  Object.assign(this, additionalData);

  return this.save();
};

Order.prototype.calculateTotal = function() {
  const subtotal = this.items.reduce((sum, item) => {
    return sum + (item.price * item.quantity);
  }, 0);

  this.subtotalAmount = subtotal;
  this.totalAmount = subtotal + this.deliveryFee;
  
  return this.totalAmount;
};

// Class methods
Order.findByUser = function(userId, options = {}) {
  return this.findAll({
    where: { user_id: userId },
    order: [['createdAt', 'DESC']],
    ...options
  });
};

Order.findByStore = function(storeId, options = {}) {
  return this.findAll({
    where: { storeId },
    order: [['createdAt', 'DESC']],
    ...options
  });
};

Order.findByCourier = function(courierId, options = {}) {
  return this.findAll({
    where: { assignedCourierId: courierId },
    order: [['createdAt', 'DESC']],
    ...options
  });
};

Order.findByStatus = function(status, options = {}) {
  return this.findAll({
    where: { status },
    order: [['createdAt', 'DESC']],
    ...options
  });
};

Order.findPending = function(options = {}) {
  return this.findAll({
    where: {
      status: ['confirmed', 'assigning']
    },
    order: [['createdAt', 'ASC']],
    ...options
  });
};

Order.findActive = function(options = {}) {
  return this.findAll({
    where: {
      status: [
        'confirmed',
        'assigning',
        'courier_assigned',
        'en_route_to_store',
        'at_store',
        'picking',
        'en_route_to_customer'
      ]
    },
    order: [['createdAt', 'ASC']],
    ...options
  });
};

Order.findToday = function(options = {}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return this.findAll({
    where: {
      createdAt: {
        [Op.gte]: today,
        [Op.lt]: tomorrow
      }
    },
    order: [['createdAt', 'DESC']],
    ...options
  });
};

module.exports = Order;
