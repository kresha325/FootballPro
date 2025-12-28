const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');
const Payment = require('./Payment');

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id',
    },
  },
  products: {
    type: DataTypes.JSON, // Array of { productId, quantity, price }
    allowNull: false,
  },
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('pending', 'paid', 'shipped', 'delivered', 'cancelled'),
    defaultValue: 'pending',
  },
  paymentId: {
    type: DataTypes.INTEGER,
    references: {
      model: Payment,
      key: 'id',
    },
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

Order.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(Order, { foreignKey: 'userId' });
Order.belongsTo(Payment, { foreignKey: 'paymentId' });
Payment.hasMany(Order, { foreignKey: 'paymentId' });

module.exports = Order;