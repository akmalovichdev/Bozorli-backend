const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const OrderItem = sequelize.define('OrderItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  order_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'orders', key: 'id' }
  },
  product_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'products', key: 'id' }
  },
  qty: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  final_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending','picked','missing','replaced'),
    allowNull: false,
    defaultValue: 'pending'
  },
  note: {
    type: DataTypes.STRING(255),
    allowNull: true
  }
}, {
  tableName: 'order_items',
  timestamps: true,
  indexes: [
    { fields: ['order_id'] },
    { fields: ['product_id'] }
  ]
});

module.exports = OrderItem;


