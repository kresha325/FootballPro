const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PaymentEvent = sequelize.define('PaymentEvent', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  provider: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'stripe' },
  eventId: { type: DataTypes.STRING(191), allowNull: false, unique: true },
  type: { type: DataTypes.STRING(120), allowNull: false },
}, {
  tableName: 'PaymentEvents',
  updatedAt: false,
});

module.exports = PaymentEvent;
