const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const LiveStream = sequelize.define('LiveStream', {
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
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  endedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('live', 'ended', 'scheduled'),
    defaultValue: 'live',
  },
  streamKey: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  viewersCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  maxDuration: {
    type: DataTypes.INTEGER,
    defaultValue: 45,
  },
  thumbnailUrl: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  isPublic: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
});

LiveStream.belongsTo(User, { as: 'user', foreignKey: 'userId' });
User.hasMany(LiveStream, { as: 'liveStreams', foreignKey: 'userId' });

module.exports = LiveStream;
