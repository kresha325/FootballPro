const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const Stream = sequelize.define('Stream', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
  },
  streamerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id',
    },
  },
  isLive: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  viewers: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  isPremium: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
    type: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
  streamKey: {
    type: DataTypes.STRING,
    unique: true,
  },
  rtmpUrl: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'RTMP ingest URL for YouTube/Twitch/other',
  },
  youtubeChannelId: {
    type: DataTypes.STRING(32),
    allowNull: true,
    comment: 'YouTube UC... për playback me embed live_stream',
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

Stream.belongsTo(User, { as: 'streamer', foreignKey: 'streamerId' });
User.hasMany(Stream, { as: 'streams', foreignKey: 'streamerId' });

module.exports = Stream;