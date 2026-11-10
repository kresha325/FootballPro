const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TournamentClubPlayerStat = sequelize.define('TournamentClubPlayerStat', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  tournamentClubEntryId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'TournamentClubEntries', key: 'id' }, onDelete: 'CASCADE' },
  athleteUserId: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL' },
  athleteName: { type: DataTypes.STRING(160), allowNull: false },
  athleteIdentityKey: { type: DataTypes.UUID, allowNull: false },
  goals: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  assists: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  updatedByUserId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' } },
}, { tableName: 'TournamentClubPlayerStats', indexes: [{ unique: true, fields: ['tournamentClubEntryId', 'athleteIdentityKey'], name: 'tournament_club_player_stats_entry_identity_uq' }] });

module.exports = TournamentClubPlayerStat;
