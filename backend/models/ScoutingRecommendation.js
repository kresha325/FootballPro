const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const ScoutingRecommendation = sequelize.define('ScoutingRecommendation', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  scoutId: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id',
    },
  },
  playerId: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id',
    },
  },
  score: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  reasons: {
    type: DataTypes.JSON, // e.g., ['High goals', 'Matching position']
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

ScoutingRecommendation.belongsTo(User, { as: 'scout', foreignKey: 'scoutId' });
ScoutingRecommendation.belongsTo(User, { as: 'player', foreignKey: 'playerId' });

module.exports = ScoutingRecommendation;