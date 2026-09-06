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
  /** Shitësi i kësaj porosie (një porosi = një shitës). */
  sellerId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: User,
      key: 'id',
    },
  },
  products: {
    // [{ productId, quantity, price, name, sellerId }]
    type: DataTypes.JSON,
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
  /** pickup | shipping | meetup */
  deliveryMethod: {
    type: DataTypes.STRING(32),
    allowNull: true,
    defaultValue: 'meetup',
  },
  deliveryAddress: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  buyerContact: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  deliveryNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  confirmedAt: {
    type: DataTypes.DATE,
    allowNull: true,
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

Order.belongsTo(User, { foreignKey: 'userId', as: 'buyer' });
Order.belongsTo(User, { foreignKey: 'sellerId', as: 'seller' });
User.hasMany(Order, { foreignKey: 'userId', as: 'purchases' });
User.hasMany(Order, { foreignKey: 'sellerId', as: 'sales' });
Order.belongsTo(Payment, { foreignKey: 'paymentId' });
Payment.hasMany(Order, { foreignKey: 'paymentId' });

module.exports = Order;
