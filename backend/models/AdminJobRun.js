const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AdminJobRun = sequelize.define('AdminJobRun', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(64), allowNull: false },
  status: { type: DataTypes.STRING(16), allowNull: false },
  startedAt: { type: DataTypes.DATE, allowNull: false },
  finishedAt: { type: DataTypes.DATE, allowNull: true },
  durationMs: { type: DataTypes.INTEGER, allowNull: true },
  error: { type: DataTypes.STRING(300), allowNull: true },
  nextRunAt: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'AdminJobRuns',
});

module.exports = AdminJobRun;
