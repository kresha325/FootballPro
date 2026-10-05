'use strict';

/** Integer cents. Financial code must not use binary floating point. */

const MAX_CENTS = 100_000_000_00; // 1,000,000.00

function toCents(value) {
  if (value == null || value === '') return null;
  const raw = String(value).trim();
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return null;
  const negative = raw.startsWith('-');
  const [wholeRaw, fracRaw = ''] = raw.replace('-', '').split('.');
  if (fracRaw.length > 2) return null;
  const whole = Number(wholeRaw);
  const frac = Number((fracRaw + '00').slice(0, 2));
  if (!Number.isSafeInteger(whole) || !Number.isSafeInteger(frac)) return null;
  const cents = whole * 100 + frac;
  if (!Number.isSafeInteger(cents) || cents > MAX_CENTS) return null;
  return negative ? -cents : cents;
}

function fromCents(cents) {
  const n = Number(cents);
  if (!Number.isSafeInteger(n)) {
    throw new Error('Invalid cents');
  }
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  return `${sign}${whole}.${frac}`;
}

function percentOfCents(cents, percent) {
  const base = toCents(fromCents(cents));
  if (base == null || base < 0) return null;
  const pct = Number(percent);
  if (!Number.isFinite(pct) || pct <= 0) return 0;
  const bps = Math.round(pct * 100);
  if (bps <= 0) return 0;
  return Math.min(base, Math.round((base * bps) / 10000));
}

module.exports = {
  MAX_CENTS,
  toCents,
  fromCents,
  percentOfCents,
};
