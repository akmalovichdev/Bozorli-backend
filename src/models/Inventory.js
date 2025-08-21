const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Inventory = sequelize.define('Inventory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  product_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'products', key: 'id' }
  },
  store_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'stores', key: 'id' }
  },
  qty: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  reserved: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  }
}, {
  tableName: 'inventory',
  timestamps: true,
  indexes: [
    { fields: ['product_id'] },
    { fields: ['store_id'] },
    { unique: true, fields: ['product_id', 'store_id'] }
  ]
});

Inventory.prototype.getAvailable = function() {
  return Math.max(0, this.qty - this.reserved);
};

module.exports = Inventory;


