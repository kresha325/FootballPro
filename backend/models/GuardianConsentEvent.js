'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GuardianConsentEvent = sequelize.define('GuardianConsentEvent', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  consentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'GuardianConsents', key: 'id' },
  },
  minorUserId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  actorUserId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'Users', key: 'id' },
  },
  actorType: { type: DataTypes.STRING(32), allowNull: false },
  eventType: { type: DataTypes.STRING(64), allowNull: false },
  metadata: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
  eventAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: 'GuardianConsentEvents',
  updatedAt: false,
  indexes: [
    { fields: ['minorUserId', 'eventAt'], name: 'guardian_consent_events_minor_time_idx' },
    { fields: ['consentId', 'eventAt'], name: 'guardian_consent_events_consent_time_idx' },
  ],
});

module.exports = GuardianConsentEvent;
