'use strict';

const { ageFromDateOnly } = require('./registerValidation');
const { Op } = require('sequelize');
const GuardianConsent = require('../models/GuardianConsent');

function isMinorAthlete(user) {
  if (String(user?.role || '').toLowerCase() !== 'athlete') return false;
  if (!user?.dateOfBirth) return false;
  return ageFromDateOnly(user.dateOfBirth) < 18;
}

async function hasActiveGuardianConsent(userId) {
  if (!userId) return false;
  return Boolean(await GuardianConsent.findOne({
    where: { minorUserId: userId, verifiedAt: { [Op.ne]: null }, revokedAt: null },
    attributes: ['id'],
  }));
}

function hasGuardianAuthorization(user, consentActive) {
  return !isMinorAthlete(user) || Boolean(user?.parentVerified && consentActive);
}

async function requiresParentalAuthorization(user) {
  if (!isMinorAthlete(user)) return false;
  return !hasGuardianAuthorization(user, await hasActiveGuardianConsent(user.id));
}

function normalizePath(req) {
  const raw = String(req?.originalUrl || req?.url || req?.path || '').split('?')[0];
  return raw.replace(/^\/api(?=\/|$)/, '').replace(/\/$/, '') || '/';
}

function isAllowedWhilePending(method, path) {
  const verb = String(method || '').toUpperCase();
  const route = String(path || '').replace(/\/$/, '') || '/';
  return (
    (verb === 'GET' && route === '/auth/me') ||
    (verb === 'PATCH' && route === '/auth/language') ||
    (verb === 'POST' && route === '/auth/logout') ||
    (verb === 'POST' && route === '/verification/parent-request') ||
    (verb === 'DELETE' && route === '/moderation/account') ||
    (verb === 'POST' && route === '/support/priority-chat')
  );
}

function parentalAuthorizationRequired(req, res) {
  res.status(403).json({
    code: 'PARENTAL_AUTHORIZATION_REQUIRED',
    msg: 'Llogaria është në pritje të autorizimit të prindit ose kujdestarit.',
    requiresParentVerification: true,
    parentAuthorizationPending: true,
  });
}

module.exports = {
  isMinorAthlete,
  hasActiveGuardianConsent,
  hasGuardianAuthorization,
  requiresParentalAuthorization,
  normalizePath,
  isAllowedWhilePending,
  parentalAuthorizationRequired,
};
