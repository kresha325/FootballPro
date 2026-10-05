const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const ScoutWatchEvent = sequelize.define(
  'ScoutWatchEvent',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    watchlistId: { type: DataTypes.INTEGER, allowNull: false },
    scoutId: { type: DataTypes.INTEGER, allowNull: false },
    playerId: { type: DataTypes.INTEGER, allowNull: false },
    type: { type: DataTypes.STRING(32), allowNull: false },
    summary: { type: DataTypes.TEXT, allowNull: false },
    payload: { type: DataTypes.JSON, allowNull: true },
    seenAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: 'ScoutWatchEvents',
    updatedAt: false,
    indexes: [
      { fields: ['scoutId', 'createdAt'] },
      { fields: ['watchlistId'] },
      { fields: ['playerId'] },
    ],
  }
);

ScoutWatchEvent.belongsTo(User, { as: 'scout', foreignKey: 'scoutId' });
ScoutWatchEvent.belongsTo(User, { as: 'player', foreignKey: 'playerId' });

module.exports = ScoutWatchEvent;
