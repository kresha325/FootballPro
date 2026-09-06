const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Report = sequelize.define(
  'Report',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    reporterId: { type: DataTypes.INTEGER, allowNull: false },
    targetType: { type: DataTypes.STRING(32), allowNull: false },
    targetId: { type: DataTypes.INTEGER, allowNull: false },
    reason: { type: DataTypes.STRING(64), allowNull: false },
    details: { type: DataTypes.TEXT, allowNull: true },
    status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'pending' },
    reviewedBy: { type: DataTypes.INTEGER, allowNull: true },
    reviewedAt: { type: DataTypes.DATE, allowNull: true },
  },
  { tableName: 'Reports' }
);

module.exports = Report;
