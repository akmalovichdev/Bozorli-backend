require('dotenv').config();
const { sequelize } = require('../config/database');
const User = require('../models/User');
const Store = require('../models/Store');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { testUsers, testStores, testProducts, testOrders } = require('./seedData');
const logger = require('./logger');

const seedDatabase = async () => {
  try {
    logger.info('Starting database seeding...');

    // Clear existing data
    await Order.destroy({ where: {} });
    await Product.destroy({ where: {} });
    await Store.destroy({ where: {} });
    await User.destroy({ where: {} });

    logger.info('Cleared existing data');

    // Create test users
    const createdUsers = await User.bulkCreate(testUsers);
    logger.info(`Created ${createdUsers.length} test users`);

    // Create test stores
    const createdStores = await Store.bulkCreate(testStores);
    logger.info(`Created ${createdStores.length} test stores`);

    // Create test products
    const createdProducts = await Product.bulkCreate(testProducts);
    logger.info(`Created ${createdProducts.length} test products`);

    // Create test orders
    const createdOrders = await Order.bulkCreate(testOrders);
    logger.info(`Created ${createdOrders.length} test orders`);

    logger.info('Database seeding completed successfully!');
    
    // Log test credentials
    logger.info('Test credentials:');
    logger.info('Customer: +998901234567 (password: 123456)');
    logger.info('Merchant: +998901234568 (password: 123456)');
    logger.info('Courier: +998901234569 (password: 123456)');

  } catch (error) {
    logger.error('Error seeding database:', error);
    throw error;
  }
};

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase()
    .then(() => {
      logger.info('Seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = seedDatabase;
