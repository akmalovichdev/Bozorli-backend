const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Task = sequelize.define('Task', {
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
  courier_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' }
  },
  status: {
    type: DataTypes.ENUM('assigned','en_route_to_store','at_store','picking','en_route_to_customer','completed','cancelled'),
    allowNull: false,
    defaultValue: 'assigned'
  },
  photos: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  tableName: 'tasks',
  timestamps: true,
  indexes: [
    { fields: ['order_id'] },
    { fields: ['courier_id'] },
    { fields: ['status'] }
  ]
});

module.exports = Task;


