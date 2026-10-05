const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const JonCoinWallet = sequelize.define('JonCoinWallet', {
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
  },
  balance: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
  },
}, {
  timestamps: true,
});

module.exports = JonCoinWallet;