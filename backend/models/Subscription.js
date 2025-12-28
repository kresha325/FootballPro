const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const Subscription = sequelize.define('Subscription', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  subscriberId: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id',
    },
  },
  subscribedToId: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id',
    },
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

Subscription.belongsTo(User, { as: 'subscriber', foreignKey: 'subscriberId' });
Subscription.belongsTo(User, { as: 'subscribedTo', foreignKey: 'subscribedToId' });
User.hasMany(Subscription, { as: 'subscriptions', foreignKey: 'subscriberId' });
User.hasMany(Subscription, { as: 'subscribers', foreignKey: 'subscribedToId' });

module.exports = Subscription;