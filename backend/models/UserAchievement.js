const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');
const Achievement = require('./Achievement');

const UserAchievement = sequelize.define('UserAchievement', {
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
  achievementId: {
    type: DataTypes.INTEGER,
    references: {
      model: 'Achievements',
      key: 'id',
    },
    allowNull: false,
  },
  unlockedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

UserAchievement.belongsTo(User, { foreignKey: 'userId' });
UserAchievement.belongsTo(Achievement, { foreignKey: 'achievementId' });
User.hasMany(UserAchievement, { foreignKey: 'userId' });
Achievement.hasMany(UserAchievement, { foreignKey: 'achievementId' });

module.exports = UserAchievement;