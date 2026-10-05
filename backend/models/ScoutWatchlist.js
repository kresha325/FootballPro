const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const ScoutWatchlist = sequelize.define(
  'ScoutWatchlist',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    scoutId: { type: DataTypes.INTEGER, allowNull: false },
    playerId: { type: DataTypes.INTEGER, allowNull: false },
    lastViewedAt: { type: DataTypes.DATE, allowNull: true },
    snapshot: { type: DataTypes.JSON, allowNull: true },
  },
  {
    tableName: 'ScoutWatchlists',
    indexes: [{ unique: true, fields: ['scoutId', 'playerId'] }],
  }
);

ScoutWatchlist.belongsTo(User, { as: 'scout', foreignKey: 'scoutId' });
ScoutWatchlist.belongsTo(User, { as: 'player', foreignKey: 'playerId' });

module.exports = ScoutWatchlist;
