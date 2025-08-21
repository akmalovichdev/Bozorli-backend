const User = require('./User');
const Store = require('./Store');
const Product = require('./Product');
const Order = require('./Order');
const Inventory = require('./Inventory');
const OrderItem = require('./OrderItem');
const Payment = require('./Payment');
const Courier = require('./Courier');
const Task = require('./Task');

// User associations
User.hasMany(Store, {
  foreignKey: 'owner_id',
  as: 'stores'
});

User.hasMany(Order, {
  foreignKey: 'user_id',
  as: 'orders'
});

User.hasMany(Order, {
  foreignKey: 'assigned_courier_id',
  as: 'courierOrders'
});

// Store associations
Store.belongsTo(User, {
  foreignKey: 'owner_id',
  as: 'owner'
});

Store.hasMany(Product, {
  foreignKey: 'store_id',
  as: 'products'
});

Store.hasMany(Order, {
  foreignKey: 'store_id',
  as: 'orders'
});

// Product associations
Product.belongsTo(Store, {
  foreignKey: 'store_id',
  as: 'store'
});

// Inventory associations
Inventory.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
Inventory.belongsTo(Store, { foreignKey: 'store_id', as: 'store' });
Product.hasMany(Inventory, { foreignKey: 'product_id', as: 'inventories' });
Store.hasMany(Inventory, { foreignKey: 'store_id', as: 'inventories' });

// Order associations
Order.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'customer'
});

Order.belongsTo(User, {
  foreignKey: 'assigned_courier_id',
  as: 'courier'
});

Order.belongsTo(Store, {
  foreignKey: 'store_id',
  as: 'store'
});

Order.hasMany(OrderItem, { foreignKey: 'order_id', as: 'itemsList' });
OrderItem.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });
OrderItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

Payment.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });
Order.hasMany(Payment, { foreignKey: 'order_id', as: 'payments' });

// Courier & Tasks
Courier.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Task.belongsTo(User, { foreignKey: 'courier_id', as: 'courier' });
Task.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });
User.hasOne(Courier, { foreignKey: 'user_id', as: 'courierProfile' });
User.hasMany(Task, { foreignKey: 'courier_id', as: 'tasks' });
Order.hasMany(Task, { foreignKey: 'order_id', as: 'tasks' });

module.exports = {
  User,
  Store,
  Product,
  Order,
  Inventory,
  OrderItem,
  Payment,
  Courier,
  Task
};
