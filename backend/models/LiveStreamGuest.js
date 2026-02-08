const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LiveStreamGuest = sequelize.define('LiveStreamGuest', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  streamId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  invitedBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('pending', 'accepted', 'declined'),
    defaultValue: 'pending',
  },
  joinedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
});

module.exports = LiveStreamGuest;
