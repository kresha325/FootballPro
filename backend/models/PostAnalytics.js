const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');
const Post = require('./Post');

const PostAnalytics = sequelize.define('PostAnalytics', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  postId: {
    type: DataTypes.INTEGER,
    references: {
      model: Post,
      key: 'id',
    },
  },
  userId: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id',
    },
  },
  type: {
    type: DataTypes.ENUM('view', 'like', 'comment', 'share'),
    allowNull: false,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

PostAnalytics.belongsTo(Post, { foreignKey: 'postId' });
PostAnalytics.belongsTo(User, { foreignKey: 'userId' });
Post.hasMany(PostAnalytics, { foreignKey: 'postId' });
User.hasMany(PostAnalytics, { foreignKey: 'userId' });

module.exports = PostAnalytics;