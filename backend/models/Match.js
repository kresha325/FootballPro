const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Match = sequelize.define('Match', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  tournamentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Tournaments',
      key: 'id',
    },
  },
  homeUserId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id',
    },
  },
  awayUserId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id',
    },
  },
  scoreHome: DataTypes.INTEGER,
  scoreAway: DataTypes.INTEGER,
  matchDate: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING(32),
    defaultValue: 'scheduled',
  },
  round: DataTypes.INTEGER, // For knockout rounds
  roundLabel: { type: DataTypes.STRING(40), allowNull: true },
  groupName: { type: DataTypes.STRING(8), allowNull: true },
  stage: { type: DataTypes.STRING(16), allowNull: true },
  halfTimeHome: { type: DataTypes.INTEGER, allowNull: true },
  halfTimeAway: { type: DataTypes.INTEGER, allowNull: true },
  extraTimeHome: { type: DataTypes.INTEGER, allowNull: true },
  extraTimeAway: { type: DataTypes.INTEGER, allowNull: true },
  penaltiesHome: { type: DataTypes.INTEGER, allowNull: true },
  penaltiesAway: { type: DataTypes.INTEGER, allowNull: true },
  winnerUserId: { type: DataTypes.INTEGER, allowNull: true },
  decidedBy: { type: DataTypes.STRING(24), allowNull: true },
  refereeUserId: { type: DataTypes.INTEGER, allowNull: true },
  refereeName: { type: DataTypes.STRING(120), allowNull: true },
  venue: { type: DataTypes.STRING(160), allowNull: true },
  highlightsUrl: { type: DataTypes.STRING(500), allowNull: true },
  publicSlug: { type: DataTypes.STRING(80), allowNull: true },
  clockMinute: { type: DataTypes.INTEGER, allowNull: true },
  clockPhase: { type: DataTypes.STRING(8), allowNull: true },
  lineup: { type: DataTypes.JSON, allowNull: true },
  minutesPlayed: {
    type: DataTypes.STRING, // shembull: "90+", "40"
    allowNull: true,
  },
  goals: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
  },
  assists: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
  },
  stadiumId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Stadiums',
      key: 'id',
    },
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  }
}, {
  tableName: 'Matches',
});


const Tournament = require('./Tournament').Tournament;
Match.belongsTo(Tournament, { foreignKey: 'tournamentId' });
module.exports = Match;