const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MEDIA_CATEGORIES = [
  'profile',
  'match',
  'match_highlight',
  'goal',
  'skills',
  'training',
  'interview',
  'other',
];

const MEDIA_VISIBILITIES = ['public', 'unlisted', 'private'];

const MediaItem = sequelize.define(
  'MediaItem',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    youtubeVideoId: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    youtubeUrl: {
      type: DataTypes.STRING(512),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    thumbnailUrl: {
      type: DataTypes.STRING(512),
      allowNull: true,
    },
    mediaType: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'youtube',
    },
    category: {
      type: DataTypes.STRING(64),
      allowNull: false,
      defaultValue: 'other',
      validate: {
        isIn: [MEDIA_CATEGORIES],
      },
    },
    playerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    clubId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    matchId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    teamId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    tournamentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    season: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    uploadedBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    visibility: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'public',
      validate: {
        isIn: [MEDIA_VISIBILITIES],
      },
    },
    durationSeconds: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    publishedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: 'MediaItems',
  }
);

MediaItem.CATEGORIES = MEDIA_CATEGORIES;
MediaItem.VISIBILITIES = MEDIA_VISIBILITIES;

module.exports = MediaItem;
