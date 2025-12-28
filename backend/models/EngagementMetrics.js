const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const EngagementMetrics = sequelize.define('EngagementMetrics', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id',
    },
  },
  date: {
    type: DataTypes.DATEONLY, // Date without time
    allowNull: false,
  },
  profileViews: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  postViews: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  likesReceived: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  commentsReceived: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  sharesReceived: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  followersGained: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  postsCreated: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
});

EngagementMetrics.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(EngagementMetrics, { foreignKey: 'userId' });

module.exports = EngagementMetrics;