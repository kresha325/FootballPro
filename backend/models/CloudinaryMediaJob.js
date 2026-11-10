'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CloudinaryMediaJob = sequelize.define('CloudinaryMediaJob', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  resourceType: { type: DataTypes.STRING(16), allowNull: false },
  publicId: { type: DataTypes.STRING(512), allowNull: false },
  fromType: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'upload' },
  toType: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'authenticated' },
  reason: { type: DataTypes.STRING(64), allowNull: false },
  status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'pending' },
  attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  nextAttemptAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  lastError: { type: DataTypes.STRING(500), allowNull: true },
  completedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'CloudinaryMediaJobs',
  indexes: [
    { unique: true, fields: ['resourceType', 'publicId', 'toType'], name: 'cloudinary_media_jobs_asset_target_uq' },
    { fields: ['status', 'nextAttemptAt'], name: 'cloudinary_media_jobs_retry_idx' },
  ],
});

module.exports = CloudinaryMediaJob;
