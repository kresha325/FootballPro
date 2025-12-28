const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const VideoCall = sequelize.define('VideoCall', {
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
  status: {
    type: DataTypes.ENUM('ringing', 'connected', 'ended'),
    defaultValue: 'ringing',
  },
  startTime: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  endTime: {
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

VideoCall.belongsTo(User, { as: 'caller', foreignKey: 'callerId' });
VideoCall.belongsTo(User, { as: 'receiver', foreignKey: 'receiverId' });
User.hasMany(VideoCall, { as: 'initiatedCalls', foreignKey: 'callerId' });
User.hasMany(VideoCall, { as: 'receivedCalls', foreignKey: 'receiverId' });

module.exports = VideoCall;