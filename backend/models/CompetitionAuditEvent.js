'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

module.exports = sequelize.define('CompetitionAuditEvent', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  tournamentId: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'Tournaments', key: 'id' }, onDelete: 'SET NULL' },
  matchId: { type: DataTypes.INTEGER, allowNull: true },
  actorUserId: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL' },
  eventType: { type: DataTypes.STRING(48), allowNull: false },
  metadata: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
  eventAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: 'CompetitionAuditEvents',
  indexes: [
    { fields: ['tournamentId', 'eventAt'], name: 'competition_audit_tournament_time_idx' },
    { fields: ['matchId'], name: 'competition_audit_match_idx' },
  ],
});
