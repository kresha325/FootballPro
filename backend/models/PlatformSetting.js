const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PlatformSetting = sequelize.define('PlatformSetting', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  key: { type: DataTypes.STRING(64), allowNull: false, unique: true },
  value: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
  updatedBy: { type: DataTypes.INTEGER, allowNull: true },
}, {
  tableName: 'PlatformSettings',
});

module.exports = PlatformSetting;
