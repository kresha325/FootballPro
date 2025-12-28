const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');
const Badge = require('./Badge');

const UserBadge = sequelize.define('UserBadge', {
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
  badgeId: {
    type: DataTypes.INTEGER,
    references: {
      model: 'Badges',
      key: 'id',
    },
    allowNull: false,
  },
  earnedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

UserBadge.belongsTo(User, { foreignKey: 'userId' });
UserBadge.belongsTo(Badge, { foreignKey: 'badgeId' });
User.hasMany(UserBadge, { foreignKey: 'userId' });
Badge.hasMany(UserBadge, { foreignKey: 'badgeId' });

module.exports = UserBadge;