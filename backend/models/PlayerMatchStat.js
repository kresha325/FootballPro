const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PlayerMatchStat = sequelize.define(
  'PlayerMatchStat',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    matchId: { type: DataTypes.INTEGER, allowNull: false },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    side: { type: DataTypes.STRING(8), allowNull: true },
    started: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    minutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    goals: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    assists: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    shots: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    shotsOnTarget: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    passes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    keyPasses: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    fouls: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    yellowCards: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    redCards: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    saves: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    cleanSheet: { type: DataTypes.BOOLEAN, allowNull: true },
    goalkeeper: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    rating: { type: DataTypes.DECIMAL(3, 1), allowNull: true },
  },
  {
    tableName: 'PlayerMatchStats',
    indexes: [
      { unique: true, fields: ['matchId', 'userId'] },
      { fields: ['userId'] },
    ],
  }
);

module.exports = PlayerMatchStat;
