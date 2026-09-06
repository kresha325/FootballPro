const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const IapPurchase = sequelize.define(
  'IapPurchase',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    platform: { type: DataTypes.STRING(16), allowNull: false },
    productId: { type: DataTypes.STRING(128), allowNull: false },
    transactionId: { type: DataTypes.STRING(191), allowNull: false },
    purchaseToken: { type: DataTypes.TEXT, allowNull: true },
    kind: { type: DataTypes.STRING(32), allowNull: false },
    status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'completed' },
    rawPayload: { type: DataTypes.JSONB, allowNull: true },
  },
  { tableName: 'IapPurchases' }
);

module.exports = IapPurchase;
