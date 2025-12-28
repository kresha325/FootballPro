const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Achievement = sequelize.define('Achievement', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
  },
  icon: {
    type: DataTypes.STRING, // URL or path to icon
  },
  points: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  experience: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  criteria: {
    type: DataTypes.JSON, // Criteria for unlocking, e.g., { type: 'posts', count: 10 }
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

module.exports = Achievement;