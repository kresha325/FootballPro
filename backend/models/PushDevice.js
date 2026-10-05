const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const PushDevice = sequelize.define(
  'PushDevice',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    platform: { type: DataTypes.STRING(16), allowNull: false },
    token: { type: DataTypes.TEXT, allowNull: false },
    tokenKey: { type: DataTypes.STRING(191), allowNull: false },
    deviceId: { type: DataTypes.STRING(128), allowNull: true },
    enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    lastSeenAt: { type: DataTypes.DATE, allowNull: true },
    invalidatedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: 'PushDevices',
    indexes: [
      { unique: true, fields: ['tokenKey'] },
      { fields: ['userId', 'enabled'] },
      { fields: ['userId', 'deviceId'] },
    ],
  }
);

PushDevice.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(PushDevice, { foreignKey: 'userId', as: 'pushDevices' });

module.exports = PushDevice;
