const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ScheduledLiveStream = sequelize.define('ScheduledLiveStream', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  scheduledAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('scheduled', 'live', 'completed', 'cancelled'),
    defaultValue: 'scheduled',
  },
});

module.exports = ScheduledLiveStream;
