const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LiveStreamAnalytics = sequelize.define('LiveStreamAnalytics', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  streamId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  viewers: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  duration: {
    type: DataTypes.INTEGER,
    defaultValue: 0, // seconds
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  endedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
});

module.exports = LiveStreamAnalytics;
