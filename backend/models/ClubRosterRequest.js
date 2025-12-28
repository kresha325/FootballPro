const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const ClubRosterRequest = sequelize.define('ClubRosterRequest', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  athleteId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
  clubId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
  position: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  jerseyNumber: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending',
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  responseMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  approvedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: User,
      key: 'id',
    },
  },
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'ClubRosterRequests',
  timestamps: true,
});

// Associations
ClubRosterRequest.belongsTo(User, { foreignKey: 'athleteId', as: 'athlete' });
ClubRosterRequest.belongsTo(User, { foreignKey: 'clubId', as: 'club' });
ClubRosterRequest.belongsTo(User, { foreignKey: 'approvedBy', as: 'approver' });

module.exports = ClubRosterRequest;
