const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const NotificationPreference = sequelize.define(
  'NotificationPreference',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    category: { type: DataTypes.STRING(32), allowNull: false },
    inApp: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    push: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    email: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    tableName: 'NotificationPreferences',
    indexes: [{ unique: true, fields: ['userId', 'category'] }],
  }
);

NotificationPreference.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(NotificationPreference, { foreignKey: 'userId' });

module.exports = NotificationPreference;
