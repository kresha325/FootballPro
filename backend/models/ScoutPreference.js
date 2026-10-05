const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const ScoutPreference = sequelize.define(
  'ScoutPreference',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    scoutId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    positions: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
    minAge: { type: DataTypes.INTEGER, allowNull: true },
    maxAge: { type: DataTypes.INTEGER, allowNull: true },
    countries: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
    foot: { type: DataTypes.STRING(16), allowNull: true },
    competitionLevel: { type: DataTypes.STRING(80), allowNull: true },
  },
  { tableName: 'ScoutPreferences' }
);

ScoutPreference.belongsTo(User, { as: 'scout', foreignKey: 'scoutId' });

module.exports = ScoutPreference;
