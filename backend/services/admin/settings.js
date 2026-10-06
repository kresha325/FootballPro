'use strict';

const { FEATURE_FLAGS } = require('./policy');

const CACHE_MS = 5000;
let cache = { at: 0, map: null };

function emptyMap() {
  return {};
}

async function loadSettings(force = false) {
  if (!force && cache.map && Date.now() - cache.at < CACHE_MS) return cache.map;
  try {
    const PlatformSetting = require('../../models/PlatformSetting');
    const rows = await PlatformSetting.findAll();
    const map = {};
    for (const row of rows) {
      map[row.key] = row.value && typeof row.value === 'object' ? row.value : {};
    }
    cache = { at: Date.now(), map };
  } catch (err) {
    if (!cache.map) cache = { at: Date.now(), map: emptyMap() };
    console.warn('platform settings:', err?.message || err);
  }
  return cache.map || emptyMap();
}

function invalidateSettings() {
  cache = { at: 0, map: null };
}

async function isFeatureEnabled(flag) {
  const map = await loadSettings();
  const row = map[`flag.${flag}`];
  if (!row || row.enabled == null) return true;
  return row.enabled !== false;
}

async function getMaintenance() {
  const map = await loadSettings();
  const row = map.maintenance;
  if (!row || row.enabled !== true) {
    return { enabled: false, message: '', estimatedMinutes: null };
  }
  const minutes = Number(row.estimatedMinutes);
  return {
    enabled: true,
    message: String(row.message || 'FootballPro is under maintenance').slice(0, 300),
    estimatedMinutes: Number.isFinite(minutes) && minutes > 0 ? minutes : null,
  };
}

async function publicConfig() {
  const features = {};
  for (const flag of FEATURE_FLAGS) {
    features[flag] = await isFeatureEnabled(flag);
  }
  const maintenance = await getMaintenance();
  return {
    features,
    maintenance: {
      enabled: maintenance.enabled,
      message: maintenance.enabled ? maintenance.message : '',
      estimatedMinutes: maintenance.enabled ? maintenance.estimatedMinutes : null,
    },
  };
}

async function writeSetting(key, value, adminId) {
  const PlatformSetting = require('../../models/PlatformSetting');
  const existing = await PlatformSetting.findOne({ where: { key } });
  if (existing) {
    existing.value = value;
    existing.updatedBy = adminId || null;
    await existing.save();
  } else {
    await PlatformSetting.create({ key, value, updatedBy: adminId || null });
  }
  invalidateSettings();
}

async function listFlags() {
  const map = await loadSettings(true);
  return FEATURE_FLAGS.map((flag) => {
    const row = map[`flag.${flag}`];
    return {
      flag,
      enabled: !row || row.enabled !== false,
      updatedAt: row?.updatedAt || null,
    };
  });
}

module.exports = {
  loadSettings,
  invalidateSettings,
  isFeatureEnabled,
  getMaintenance,
  publicConfig,
  writeSetting,
  listFlags,
};
