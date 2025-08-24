const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Courier = sequelize.define('Courier', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' }
  },
  vehicle_info: {
    type: DataTypes.JSON,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('offline','idle','busy','suspended'),
    defaultValue: 'offline'
  },
  current_location: {
    type: DataTypes.GEOMETRY('POINT'),
    allowNull: true
  },
  last_seen: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'couriers',
  timestamps: true,
  indexes: [
    { fields: ['user_id'], unique: true },
    { fields: ['status'] }
  ]
});

module.exports = Courier;


