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
  vehicleInfo: {
    type: DataTypes.JSON,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('offline','idle','busy','suspended'),
    defaultValue: 'offline'
  },
  currentLocation: {
    type: DataTypes.GEOMETRY('POINT'),
    allowNull: true
  },
  lastSeen: {
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


