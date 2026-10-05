const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const decimal = { type: DataTypes.DECIMAL(3, 1), allowNull: true };

const ScoutingReport = sequelize.define(
  'ScoutingReport',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    scoutId: { type: DataTypes.INTEGER, allowNull: false },
    playerId: { type: DataTypes.INTEGER, allowNull: false },
    reportDate: { type: DataTypes.DATEONLY, allowNull: false },
    tournamentId: { type: DataTypes.INTEGER, allowNull: true },
    matchId: { type: DataTypes.INTEGER, allowNull: true },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'draft' },
    positionGroup: { type: DataTypes.STRING(24), allowNull: true },
    technical: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
    physical: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
    tactical: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
    mental: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
    positionSpecific: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
    strengths: { type: DataTypes.TEXT, allowNull: true },
    weaknesses: { type: DataTypes.TEXT, allowNull: true },
    potential: { type: DataTypes.TEXT, allowNull: true },
    potentialRating: decimal,
    recommendation: { type: DataTypes.STRING(16), allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    technicalRating: decimal,
    physicalRating: decimal,
    tacticalRating: decimal,
    mentalRating: decimal,
    overallRating: decimal,
  },
  {
    tableName: 'ScoutingReports',
    indexes: [
      { fields: ['scoutId', 'playerId'] },
      { fields: ['scoutId', 'status'] },
      { fields: ['playerId'] },
      { fields: ['matchId'] },
    ],
  }
);

ScoutingReport.belongsTo(User, { as: 'scout', foreignKey: 'scoutId' });
ScoutingReport.belongsTo(User, { as: 'player', foreignKey: 'playerId' });

module.exports = ScoutingReport;
