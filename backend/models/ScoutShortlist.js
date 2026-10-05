const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const ScoutShortlist = sequelize.define(
  'ScoutShortlist',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    scoutId: { type: DataTypes.INTEGER, allowNull: false },
    playerId: { type: DataTypes.INTEGER, allowNull: false },
    note: { type: DataTypes.TEXT, allowNull: true },
    priority: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'MEDIUM' },
    status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'NEW' },
    followUpDate: { type: DataTypes.DATEONLY, allowNull: true },
  },
  {
    tableName: 'ScoutShortlists',
    indexes: [
      { unique: true, fields: ['scoutId', 'playerId'] },
      { fields: ['scoutId', 'status'] },
      { fields: ['scoutId', 'priority'] },
      { fields: ['scoutId', 'followUpDate'] },
    ],
  }
);

ScoutShortlist.belongsTo(User, { as: 'scout', foreignKey: 'scoutId' });
ScoutShortlist.belongsTo(User, { as: 'player', foreignKey: 'playerId' });

module.exports = ScoutShortlist;
