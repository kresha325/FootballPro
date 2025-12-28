const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserReward = sequelize.define('UserReward', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    references: {
      model: 'Users',
      key: 'id',
    },
    allowNull: false,
  },
  rewardId: {
    type: DataTypes.INTEGER,
    references: {
      model: 'Rewards',
      key: 'id',
    },
    allowNull: false,
  },
  claimedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

module.exports = UserReward;