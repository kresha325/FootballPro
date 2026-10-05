const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const Gallery = sequelize.define('Gallery', {
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
  title: DataTypes.STRING,
  description: DataTypes.TEXT,
  imageUrl: DataTypes.STRING,
  videoUrl: DataTypes.STRING,
  type: {
    type: DataTypes.ENUM('photo', 'video', 'highlight'),
    defaultValue: 'photo',
  },
  visibility: {
    type: DataTypes.STRING(16),
    allowNull: false,
    defaultValue: 'public',
  },
  featured: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  sortOrder: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  timestamps: true
});

Gallery.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(Gallery, { foreignKey: 'userId' });

module.exports = Gallery;