const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AdminErrorGroup = sequelize.define('AdminErrorGroup', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  fingerprint: { type: DataTypes.STRING(191), allowNull: false, unique: true },
  method: { type: DataTypes.STRING(12), allowNull: true },
  path: { type: DataTypes.STRING(191), allowNull: false },
  message: { type: DataTypes.STRING(300), allowNull: false },
  severity: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'HIGH' },
  statusCode: { type: DataTypes.INTEGER, allowNull: true },
  count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  firstSeenAt: { type: DataTypes.DATE, allowNull: false },
  lastSeenAt: { type: DataTypes.DATE, allowNull: false },
}, {
  tableName: 'AdminErrorGroups',
});

module.exports = AdminErrorGroup;
