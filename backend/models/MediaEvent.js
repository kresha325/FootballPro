const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MEDIA_EVENT_TYPES = ['impression', 'open', 'page_open', 'profile_click'];

const MediaEvent = sequelize.define(
  'MediaEvent',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    mediaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    eventType: {
      type: DataTypes.STRING(64),
      allowNull: false,
      validate: {
        isIn: [MEDIA_EVENT_TYPES],
      },
    },
  },
  {
    tableName: 'MediaEvents',
  }
);

MediaEvent.EVENT_TYPES = MEDIA_EVENT_TYPES;

module.exports = MediaEvent;
