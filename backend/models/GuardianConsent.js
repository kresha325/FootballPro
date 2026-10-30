'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GuardianConsent = sequelize.define('GuardianConsent', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  minorUserId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  guardianUserId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'Users', key: 'id' },
  },
  guardianEmail: { type: DataTypes.STRING(320), allowNull: false },
  guardianName: { type: DataTypes.STRING(160), allowNull: true },
  relationship: { type: DataTypes.STRING(32), allowNull: true },
  consentPurpose: { type: DataTypes.STRING(64), allowNull: false },
  consentScope: { type: DataTypes.JSON, allowNull: false },
  policyVersion: { type: DataTypes.STRING(32), allowNull: false },
  verificationMethod: { type: DataTypes.STRING(48), allowNull: false },
  verificationTokenHash: { type: DataTypes.STRING(64), allowNull: true, unique: true },
  verificationTokenExpiresAt: { type: DataTypes.DATE, allowNull: true },
  managementTokenHash: { type: DataTypes.STRING(64), allowNull: true, unique: true },
  managementTokenExpiresAt: { type: DataTypes.DATE, allowNull: true },
  verifiedAt: { type: DataTypes.DATE, allowNull: true },
  revokedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'GuardianConsents',
  indexes: [
    { fields: ['minorUserId', 'verifiedAt', 'revokedAt'], name: 'guardian_consents_minor_state_idx' },
  ],
});

module.exports = GuardianConsent;
