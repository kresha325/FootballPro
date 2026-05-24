'use strict';

const ALLOWED_REGISTER_ROLES = [
  'athlete',
  'coach',
  'scout',
  'manager',
  'referee',
  'club',
  'federation',
  'media',
  'business',
];

function parseDateOnly(value) {
  if (!value) return { valid: false, value: null };
  const s = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { valid: false, value: null };
  const d = new Date(`${s}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return { valid: false, value: null };
  const [y, m, day] = s.split('-').map(Number);
  if (d.getUTCFullYear() !== y || d.getUTCMonth() + 1 !== m || d.getUTCDate() !== day) {
    return { valid: false, value: null };
  }
  const today = new Date();
  if (d > today) return { valid: false, value: null };
  return { valid: true, value: s };
}

function ageFromDateOnly(dateOnly) {
  const today = new Date();
  const iso =
    typeof dateOnly === 'string'
      ? dateOnly.slice(0, 10)
      : dateOnly instanceof Date
        ? dateOnly.toISOString().slice(0, 10)
        : String(dateOnly).slice(0, 10);
  const birth = new Date(`${iso}T12:00:00.000Z`);
  let age = today.getFullYear() - birth.getUTCFullYear();
  const m = today.getMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getUTCDate())) age -= 1;
  return age;
}

module.exports = {
  ALLOWED_REGISTER_ROLES,
  parseDateOnly,
  ageFromDateOnly,
};
