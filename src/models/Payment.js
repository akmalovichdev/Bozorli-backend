const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Payment = sequelize.define('Payment', {
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
  provider: {
    type: DataTypes.ENUM('click','payme','uzum','stripe'),
    allowNull: false
  },
  providerPaymentId: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  amount: {
    type: DataTypes.DECIMAL(10,2),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending','authorized','captured','failed','refunded'),
    allowNull: false,
    defaultValue: 'pending'
  },
  capturedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  tableName: 'payments',
  timestamps: true,
  indexes: [
    { fields: ['order_id'] },
    { fields: ['provider'] },
    { fields: ['status'] }
  ]
});

module.exports = Payment;


