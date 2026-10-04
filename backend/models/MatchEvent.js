const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MatchEvent = sequelize.define(
  'MatchEvent',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    matchId: { type: DataTypes.INTEGER, allowNull: false },
    type: { type: DataTypes.STRING(32), allowNull: false },
    userId: { type: DataTypes.INTEGER, allowNull: true },
    relatedUserId: { type: DataTypes.INTEGER, allowNull: true },
    side: { type: DataTypes.STRING(8), allowNull: true },
    minute: { type: DataTypes.INTEGER, allowNull: true },
    detail: { type: DataTypes.STRING(500), allowNull: true },
    eventKey: { type: DataTypes.STRING(200), allowNull: false },
  },
  {
    tableName: 'MatchEvents',
    indexes: [
      { unique: true, fields: ['matchId', 'eventKey'] },
      { fields: ['matchId'] },
      { fields: ['userId'] },
    ],
  }
);

module.exports = MatchEvent;
