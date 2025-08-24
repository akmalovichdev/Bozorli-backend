const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - phone
 *         - fullName
 *         - role
 *       properties:
 *         id:
 *           type: string
 *           description: Unique identifier for the user
 *         phone:
 *           type: string
 *           description: User's phone number
 *         email:
 *           type: string
 *           format: email
 *           description: User's email address
 *         fullName:
 *           type: string
 *           description: User's full name
 *         role:
 *           type: string
 *           enum: [customer, merchant, courier, admin, owner]
 *           description: User's role in the system
 *         walletBalance:
 *           type: number
 *           description: User's wallet balance
 *         isActive:
 *           type: boolean
 *           description: Whether the user account is active
 *         isVerified:
 *           type: boolean
 *           description: Whether the user's phone is verified
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: {
      notEmpty: true,
      is: /^\+?[1-9]\d{1,14}$/ // E.164 format
    }
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isEmail: true
    }
  },
  full_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [2, 100]
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [6, 255]
    }
  },
  role: {
    type: DataTypes.ENUM('customer', 'merchant', 'courier', 'admin', 'owner'),
    allowNull: false,
    defaultValue: 'customer'
  },
  wallet_balance: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  is_verified: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  last_login_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  avatar: {
    type: DataTypes.STRING,
    allowNull: true
  },
  // Additional fields for different roles
  date_of_birth: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  gender: {
    type: DataTypes.ENUM('male', 'female', 'other'),
    allowNull: true
  },
  // For couriers
  vehicle_info: {
    type: DataTypes.JSON,
    allowNull: true
  },
  documents: {
    type: DataTypes.JSON,
    allowNull: true
  },
  // For merchants
  business_info: {
    type: DataTypes.JSON,
    allowNull: true
  },
  kyc_status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    allowNull: true
  }
}, {
  tableName: 'users',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['phone']
    }
  ],
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 12);
        user.password = await bcrypt.hash(user.password, salt);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 12);
        user.password = await bcrypt.hash(user.password, salt);
      }
    }
  }
});

// Instance methods
User.prototype.comparePassword = async function(candidatePassword) {
  // If user has no password (OTP-based auth), return false for password login
  if (!this.password) return false;
  // Ensure both arguments are strings
  const candidatePasswordStr = String(candidatePassword);
  const storedPasswordStr = String(this.password);
  return await bcrypt.compare(candidatePasswordStr, storedPasswordStr);
};

User.prototype.toJSON = function() {
  const values = Object.assign({}, this.get());
  delete values.password;
  return values;
};

// Class methods
User.findByPhone = function(phone) {
  return this.findOne({ where: { phone } });
};

User.findByEmail = function(email) {
  return this.findOne({ where: { email } });
};

User.findActiveUsers = function() {
  return this.findAll({ where: { isActive: true } });
};

User.findByRole = function(role) {
  return this.findAll({ where: { role, isActive: true } });
};

module.exports = User;
