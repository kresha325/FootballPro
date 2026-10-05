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
    Product.count({ where: { sellerId: user.id } }),
    Order.count({ where: { sellerId: user.id } }),
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
  if (modules.includes('player')) {
    jobs.push(playerAnalytics(user.id, range).then((value) => { payload.player = value; }));
  }
  if (modules.includes('social') && socialAllowed) {
    jobs.push(socialTotals(user.id, range).then((value) => { payload.social = value; }));
  }
  if (modules.includes('video')) {
    jobs.push(videoAnalytics(user.id, range).then((value) => { payload.video = value; }));
  }
  if (modules.includes('scouting')) {
    jobs.push(scoutAnalytics(user.id, range).then((value) => { payload.scouting = value; }));
  }
  if (modules.includes('scoutingInterest')) {
    jobs.push(playerScoutingInterest(user.id, range).then((value) => { payload.scoutingInterest = value; }));
  }
  if (modules.includes('club')) {
    jobs.push(clubAnalytics(user.id, range).then((value) => { payload.club = value; }));
  }
  if (modules.includes('marketplace')) {
    jobs.push(marketplaceAnalytics(user.id, range).then((value) => { payload.marketplace = value; }));
  }
  if (modules.includes('wallet')) {
    jobs.push(walletAnalytics(user.id, range).then((value) => { payload.wallet = value; }));
  }
  await Promise.all(jobs);
  return payload;
}

module.exports = {
  modulesFor,
  personalDashboard,
  SCOUT_ROLES,
};
