'use strict';

const { hasTier } = require('../../utils/subscriptionAccess');
const { playerAnalytics } = require('./player');
const { socialTotals } = require('./social');
const { videoAnalytics } = require('./video');
const { scoutAnalytics, playerScoutingInterest } = require('./scouting');
const { clubAnalytics } = require('./club');
const { marketplaceAnalytics } = require('./marketplace');
const { walletAnalytics } = require('./wallet');
const Product = require('../../models/Product');
const Order = require('../../models/Order');

const SCOUT_ROLES = new Set(['scout', 'club', 'manager']);

function modulesFor(role, { hasProducts }) {
  const key = String(role || '').toLowerCase();
  const modules = ['wallet'];
  if (key === 'athlete') modules.push('player', 'social', 'video', 'scoutingInterest');
  else if (key === 'coach' || key === 'trajner') modules.push('social', 'video');
  else if (key === 'club') modules.push('club', 'social', 'scouting');
  else if (SCOUT_ROLES.has(key)) modules.push('scouting', 'social');
  else if (['business', 'media', 'federation', 'liga'].includes(key)) modules.push('social', 'video');
  else modules.push('social');
  if (hasProducts) modules.push('marketplace');
  return [...new Set(modules)];
}

async function personalDashboard(user, range) {
  const [products, sales] = await Promise.all([
    Product.count({ where: { sellerId: user.id } }).catch((err) => {
      console.error('analytics home products:', err?.message || err);
      return 0;
    }),
    Order.count({ where: { sellerId: user.id } }).catch((err) => {
      console.error('analytics home orders:', err?.message || err);
      return 0;
    }),
  ]);
  const modules = modulesFor(user.role, { hasProducts: products > 0 || sales > 0 });
  const socialAllowed = hasTier(user, 'basic');
  const payload = {
    role: user.role,
    range: {
      key: range.key,
      label: range.label,
      from: range.from,
      to: range.to,
      cumulative: Boolean(range.cumulative),
    },
    modules,
    player: null,
    social: null,
    socialLocked: modules.includes('social') && !socialAllowed,
    video: null,
    scouting: null,
    scoutingInterest: null,
    club: null,
    marketplace: null,
    wallet: null,
    generatedAt: new Date().toISOString(),
  };

  const jobs = [];
  const run = (name, loader) => jobs.push(
    loader().then((value) => {
      payload[name] = value;
    }).catch((err) => {
      console.error(`analytics home ${name}:`, err?.message || err);
      payload[name] = null;
    })
  );
  if (modules.includes('player')) run('player', () => playerAnalytics(user.id, range));
  if (modules.includes('social') && socialAllowed) run('social', () => socialTotals(user.id, range));
  if (modules.includes('video')) run('video', () => videoAnalytics(user.id, range));
  if (modules.includes('scouting')) run('scouting', () => scoutAnalytics(user.id, range));
  if (modules.includes('scoutingInterest')) run('scoutingInterest', () => playerScoutingInterest(user.id, range));
  if (modules.includes('club')) run('club', () => clubAnalytics(user.id, range));
  if (modules.includes('marketplace')) run('marketplace', () => marketplaceAnalytics(user.id, range));
  if (modules.includes('wallet')) run('wallet', () => walletAnalytics(user.id, range));
  await Promise.all(jobs);
  return payload;
}

module.exports = {
  modulesFor,
  personalDashboard,
  SCOUT_ROLES,
};
