'use strict';

const { toCents, fromCents, percentOfCents } = require('../utils/money');

/**
 * Canonical XCoin / JonCoin exchange rule.
 * 1 JonCoin = 1 EUR unless JONCOIN_PER_EUR overrides it.
 * Every other module must read the rate from here.
 */
function getJoncoinPerEur() {
  const raw = Number(process.env.JONCOIN_PER_EUR ?? '1');
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  return raw;
}

function getMarketplaceFeePercent() {
  const raw = Number(process.env.JONCOIN_MARKETPLACE_FEE_PERCENT ?? '0');
  if (!Number.isFinite(raw)) return 0;
  return Math.min(25, Math.max(0, raw));
}

function getWithdrawCommissionPercent() {
  const raw = Number(process.env.JONCOIN_WITHDRAW_COMMISSION_PERCENT ?? '5');
  if (!Number.isFinite(raw)) return 5;
  return Math.min(25, Math.max(0, raw));
}

function getPlatformUserId() {
  const id = parseInt(process.env.JONCOIN_PLATFORM_USER_ID || '', 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** EUR decimal or cents → JonCoin cents at the canonical rate. */
function eurCentsToJoncoinCents(eurCents) {
  const cents = Number(eurCents);
  if (!Number.isInteger(cents) || cents < 0) return null;
  const rate = getJoncoinPerEur();
  return Math.round(cents * rate);
}

function joncoinCentsToEurCents(joncoinCents) {
  const cents = Number(joncoinCents);
  if (!Number.isInteger(cents) || cents < 0) return null;
  const rate = getJoncoinPerEur();
  if (rate === 0) return null;
  return Math.round(cents / rate);
}

function priceToJoncoinCents(price) {
  const eurCents = toCents(price);
  if (eurCents == null || eurCents < 0) return null;
  return eurCentsToJoncoinCents(eurCents);
}

/**
 * Buyer pays gross. Seller receives net. Fee is withheld from the seller.
 * @returns {{ grossCents: number, feeCents: number, netCents: number }}
 */
function splitGross(grossCents, feePercent = getMarketplaceFeePercent()) {
  const gross = Number(grossCents);
  if (!Number.isInteger(gross) || gross < 0) {
    throw Object.assign(new Error('Shuma e pavlefshme'), { status: 400 });
  }
  const feeCents = percentOfCents(gross, feePercent) || 0;
  return { grossCents: gross, feeCents, netCents: gross - feeCents };
}

function economyPublicConfig() {
  let cardDepositsEnabled = false;
  try {
    cardDepositsEnabled = require('./payments').stripeLiveReady();
  } catch (_err) {
    cardDepositsEnabled = false;
  }
  return {
    currency: 'JON',
    priceCurrency: 'EUR',
    joncoinPerEur: getJoncoinPerEur(),
    marketplaceFeePercent: getMarketplaceFeePercent(),
    withdrawCommissionPercent: getWithdrawCommissionPercent(),
    cardDepositsEnabled,
  };
}

module.exports = {
  getJoncoinPerEur,
  getMarketplaceFeePercent,
  getWithdrawCommissionPercent,
  getPlatformUserId,
  eurCentsToJoncoinCents,
  joncoinCentsToEurCents,
  priceToJoncoinCents,
  splitGross,
  economyPublicConfig,
  fromCents,
  toCents,
};
