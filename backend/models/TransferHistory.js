const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const TransferHistory = sequelize.define('TransferHistory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
  transferType: {
    type: DataTypes.ENUM('player_transfer', 'coach_appointment', 'staff_appointment', 'loan'),
    allowNull: false,
  },
  fromClub: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  toClub: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  position: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  season: {
    type: DataTypes.STRING, // e.g., "2024/2025"
    allowNull: false,
  },
  transferDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  transferFee: {
    type: DataTypes.STRING, // e.g., "Free", "€5M", "Loan"
    allowNull: true,
  },
  contractUntil: {
    type: DataTypes.STRING, // e.g., "2026"
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
});

TransferHistory.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(TransferHistory, { foreignKey: 'userId' });

module.exports = TransferHistory;
