const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TournamentClubEntry = sequelize.define('TournamentClubEntry', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  tournamentId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'Tournaments', key: 'id' }, onDelete: 'CASCADE' },
  clubUserId: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL' },
  clubName: { type: DataTypes.STRING(160), allowNull: false },
  groupName: { type: DataTypes.STRING(8), allowNull: true },
  claimStatus: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'unclaimed' },
  claimRequestedBy: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL' },
  played: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  wins: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  draws: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  losses: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  goalsFor: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  goalsAgainst: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  points: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, { tableName: 'TournamentClubEntries', indexes: [{ unique: true, fields: ['tournamentId', 'clubUserId'], name: 'tournament_club_entries_tournament_club_uq' }] });

module.exports = TournamentClubEntry;
