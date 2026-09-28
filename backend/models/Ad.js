const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Ad = sequelize.define('Ad', {
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  text: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  color: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: '#34d399',
  },
  startDate: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  endDate: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  imageUrl: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  videoUrl: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  /** image | video */
  mediaType: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'image',
  },
  /** How long this ad stays on screen in the feed carousel (€1/day = 3s). */
  displaySeconds: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 3,
  },
  priceEur: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 1,
  },
  /** Source media length in seconds (videos). */
  mediaDurationSec: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
}, {
  tableName: 'Ads',
});

module.exports = Ad;
