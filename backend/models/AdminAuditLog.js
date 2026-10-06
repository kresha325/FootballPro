const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AdminAuditLog = sequelize.define('AdminAuditLog', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  adminId: { type: DataTypes.INTEGER, allowNull: false },
  action: { type: DataTypes.STRING(64), allowNull: false },
  entity: { type: DataTypes.STRING(64), allowNull: false },
  entityId: { type: DataTypes.STRING(64), allowNull: true },
  result: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'success' },
  reason: { type: DataTypes.TEXT, allowNull: true },
  metadata: { type: DataTypes.JSON, allowNull: true },
}, {
  tableName: 'AdminAuditLogs',
});

module.exports = AdminAuditLog;
