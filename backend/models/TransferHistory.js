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
  fromClubUserId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: User,
      key: 'id',
    },
  },
  toClubUserId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: User,
      key: 'id',
    },
  },
  position: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  season: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  transferDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  transferFee: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  contractUntil: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  /** pending | confirmed | rejected | cancelled */
  status: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'pending',
  },
  fromClubConfirmedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  fromClubConfirmedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  toClubConfirmedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  toClubConfirmedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  rejectedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  rejectedByClubUserId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  rejectionReason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
});

TransferHistory.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(TransferHistory, { foreignKey: 'userId' });

module.exports = TransferHistory;
