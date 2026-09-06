const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Invoice = sequelize.define(
  'Invoice',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    invoiceNumber: { type: DataTypes.STRING(32), allowNull: false },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    kind: { type: DataTypes.STRING(32), allowNull: false },
    source: { type: DataTypes.STRING(32), allowNull: false },
    status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'completed' },
    amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    currency: { type: DataTypes.STRING(8), allowNull: false, defaultValue: 'EUR' },
    description: { type: DataTypes.STRING(255), allowNull: true },
    plan: { type: DataTypes.STRING(32), allowNull: true },
    productId: { type: DataTypes.STRING(128), allowNull: true },
    joncoinAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
    externalId: { type: DataTypes.STRING(191), allowNull: true },
    paymentId: { type: DataTypes.INTEGER, allowNull: true },
    iapPurchaseId: { type: DataTypes.INTEGER, allowNull: true },
    joncoinTransactionId: { type: DataTypes.INTEGER, allowNull: true },
    rawPayload: { type: DataTypes.JSONB, allowNull: true },
  },
  { tableName: 'Invoices' }
);

module.exports = Invoice;
