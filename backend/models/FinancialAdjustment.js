const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FinancialAdjustment = sequelize.define('FinancialAdjustment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  adminId: { type: DataTypes.INTEGER, allowNull: false },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  direction: { type: DataTypes.STRING(16), allowNull: false },
  amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  balanceBefore: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
  balanceAfter: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
  reason: { type: DataTypes.TEXT, allowNull: false },
  ledgerTransactionId: { type: DataTypes.INTEGER, allowNull: true },
}, {
  tableName: 'FinancialAdjustments',
});

module.exports = FinancialAdjustment;
