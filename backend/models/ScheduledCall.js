const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const ScheduledCall = sequelize.define('ScheduledCall', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  callerId: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id',
    },
  },
  receiverId: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id',
    },
  },
  scheduledTime: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('scheduled', 'completed', 'cancelled'),
    defaultValue: 'scheduled',
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

ScheduledCall.belongsTo(User, { as: 'caller', foreignKey: 'callerId' });
ScheduledCall.belongsTo(User, { as: 'receiver', foreignKey: 'receiverId' });
User.hasMany(ScheduledCall, { as: 'scheduledCalls', foreignKey: 'callerId' });
User.hasMany(ScheduledCall, { as: 'receivedScheduledCalls', foreignKey: 'receiverId' });

module.exports = ScheduledCall;