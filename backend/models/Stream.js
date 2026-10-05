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
  videoUrl: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Path or URL to uploaded recording when not live',
  },
  status: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'ready',
  },
  visibility: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'public',
  },
  provider: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'livekit',
  },
  providerId: {
    type: DataTypes.STRING(128),
    allowNull: true,
  },
  thumbnailUrl: {
    type: DataTypes.STRING(512),
    allowNull: true,
  },
  scheduledAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  endedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  matchId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  tournamentId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  playerId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  clubId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  featured: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  notifiedStartingSoon: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
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

const Match = require('./Match');
const { Tournament } = require('./Tournament');
Stream.belongsTo(Match, { foreignKey: 'matchId' });
Stream.belongsTo(Tournament, { foreignKey: 'tournamentId' });
Stream.belongsTo(User, { as: 'player', foreignKey: 'playerId' });
Stream.belongsTo(User, { as: 'club', foreignKey: 'clubId' });

module.exports = Stream;