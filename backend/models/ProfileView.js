const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const ProfileView = sequelize.define('ProfileView', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  viewerId: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id',
    },
  },
  profileId: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id',
    },
  },
  viewedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

ProfileView.belongsTo(User, { foreignKey: 'viewerId', as: 'viewer' });
ProfileView.belongsTo(User, { foreignKey: 'profileId', as: 'profile' });
User.hasMany(ProfileView, { foreignKey: 'viewerId', as: 'viewsGiven' });
User.hasMany(ProfileView, { foreignKey: 'profileId', as: 'viewsReceived' });

module.exports = ProfileView;