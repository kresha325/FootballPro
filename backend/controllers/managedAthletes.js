'use strict';

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const User = require('../models/User');
const Profile = require('../models/Profile');
const ClubMember = require('../models/ClubMember');
const ClubStaff = require('../models/ClubStaff');
const GuardianConsent = require('../models/GuardianConsent');
const { sendEmail } = require('../services/emailService');
const { createRawToken, hashToken } = require('../utils/guardianConsentSecurity');
const { syncOverallVerified } = require('../utils/userVerification');
const {
  validateManagedAthleteInput,
  isActiveCoachAssignment,
  isVerifiedClub,
  canAdminRegisterAthlete,
  isMinorAthleteRecord,
} = require('../utils/managedAthleteRegistration');

const CONSENT_SCOPE = ['account_access', 'sports_profile', 'tournaments', 'safety_moderation'];
const CONSENT_POLICY_VERSION = process.env.PARENTAL_CONSENT_POLICY_VERSION || '2026-10-v1';
const CONSENT_TTL_MS = 48 * 60 * 60 * 1000;
const TEAM_TYPES = ['first_team', 'youth', 'women', 'men', 'u23', 'u21', 'u19', 'u17', 'u15', 'u13', 'u11', 'u9'];

function errorResponse(res, status, msg) {
  return res.status(status).json({ msg });
}

async function getAuthorizedClub(actor, requestedClubId, transaction = null) {
  const role = String(actor?.role || '').toLowerCase();
  let clubId = Number(requestedClubId);

  if (role === 'club') {
    if (requestedClubId != null && requestedClubId !== '' && clubId !== Number(actor.id)) {
      return { error: { status: 403, msg: 'Klubi mund të regjistrojë atletë vetëm për vete.' } };
    }
    clubId = Number(actor.id);
  } else if (!Number.isInteger(clubId) || clubId < 1) {
    return { error: { status: 400, msg: 'Klubi është i detyrueshëm.' } };
  }

  if (role === 'coach') {
    const assignments = await ClubStaff.findAll({
      where: { clubId, staffId: actor.id, status: 'active' },
      order: [['createdAt', 'DESC']],
    });
    if (!assignments.some((assignment) => isActiveCoachAssignment(actor, assignment, clubId))) {
      return { error: { status: 403, msg: 'Nuk ke autorizim aktiv stërvitor për këtë klub.' } };
    }
  } else if (role === 'admin') {
    if (!canAdminRegisterAthlete(actor)) {
      return { error: { status: 403, msg: 'Nuk ke leje për menaxhimin e atletëve.' } };
    }
  } else if (role !== 'club') {
    return { error: { status: 403, msg: 'Vetëm klubi, trajneri i autorizuar ose administratori mund të regjistrojë atletë.' } };
  }

  const club = await User.findByPk(clubId, {
    attributes: ['id', 'role', 'firstName', 'lastName', 'language', 'adminVerified', 'deletedAt', 'bannedAt'],
    transaction,
    ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}),
  });
  if (!isVerifiedClub(club)) {
    return { error: { status: 403, msg: 'Klubi nuk është i verifikuar nga administratori ose nuk është aktiv.' } };
  }
  return { club };
}

function makeManagedIdentity() {
  // This is an unclaimable alias, not a deliverable contact address or activation secret.
  const suffix = crypto.randomBytes(18).toString('hex');
  const rawPassword = crypto.randomBytes(48).toString('base64url');
  return { email: `managed-${suffix}@athlete.invalid`, rawPassword };
}

async function createParentConsentRequest(user, guardianEmail, transaction) {
  const token = createRawToken();
  const now = new Date();
  await GuardianConsent.update(
    { verificationTokenHash: null, verificationTokenExpiresAt: null },
    { where: { minorUserId: user.id, verifiedAt: null, revokedAt: null }, transaction }
  );
  await GuardianConsent.create({
    minorUserId: user.id,
    guardianEmail,
    consentPurpose: 'minor_account_authorization',
    consentScope: CONSENT_SCOPE,
    policyVersion: CONSENT_POLICY_VERSION,
    verificationMethod: 'guardian_email_attestation',
    verificationTokenHash: hashToken(token),
    verificationTokenExpiresAt: new Date(now.getTime() + CONSENT_TTL_MS),
  }, { transaction });
  user.parentEmail = guardianEmail;
  user.parentVerified = false;
  user.parentVerificationToken = null;
  user.parentVerificationExpire = null;
  await user.save({ transaction });
  return token;
}

async function emailParentConsent(user, token) {
  const athleteName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Atleti';
  return sendEmail(user.parentEmail, 'parentVerification', athleteName, token, user.language || 'sq');
}

exports.createManagedAthlete = async (req, res) => {
  const validation = validateManagedAthleteInput(req.body);
  if (!validation.ok) return errorResponse(res, validation.status, validation.message);
  const input = validation.value;
  const requestedClubId = req.body?.clubId;
  let user;
  let membership;
  let parentToken = null;

  try {
    const result = await sequelize.transaction(async (transaction) => {
      const authorized = await getAuthorizedClub(req.user, requestedClubId, transaction);
      if (authorized.error) {
        const error = new Error(authorized.error.msg);
        error.status = authorized.error.status;
        throw error;
      }
      const { club } = authorized;

      // Serialize the same normalized identity across clubs too, preventing a
      // concurrent same-athlete request from racing the duplicate lookup.
      const identityLock = `${input.dateOfBirth}:${input.firstName.toLowerCase()}:${input.lastName.toLowerCase()}`;
      if (sequelize.getDialect() === 'postgres') {
        await sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:identityLock))', {
          replacements: { identityLock },
          transaction,
        });
      }

      // Locking the verified club row also serializes roster writes for that club.
      const existing = await User.findOne({
        where: {
          role: 'athlete',
          dateOfBirth: input.dateOfBirth,
          [Op.and]: [
            sequelize.where(sequelize.fn('LOWER', sequelize.col('firstName')), input.firstName.toLowerCase()),
            sequelize.where(sequelize.fn('LOWER', sequelize.col('lastName')), input.lastName.toLowerCase()),
          ],
          deletedAt: null,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (existing) {
        const duplicateMembership = await ClubMember.findOne({
          where: { athleteId: existing.id, clubId: club.id },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        const error = new Error(duplicateMembership
          ? 'Ky atlet është regjistruar tashmë në këtë klub.'
          : 'U gjet një atlet me të njëjtin emër dhe datëlindje. Kërko verifikim manual; transferimi nuk bëhet nga ky formular.');
        error.status = 409;
        throw error;
      }

      const identity = makeManagedIdentity();
      const password = await bcrypt.hash(identity.rawPassword, 12);
      user = await User.create({
        email: identity.email,
        password,
        role: 'athlete',
        firstName: input.firstName,
        lastName: input.lastName,
        dateOfBirth: input.dateOfBirth,
        language: club.language || 'sq',
        verified: false,
        adminVerified: false,
        premium: false,
        parentEmail: input.minor ? input.parentEmail : null,
        parentVerified: false,
        clubVerified: true,
        clubVerifiedAt: new Date(),
      }, { transaction });
      syncOverallVerified(user);
      await user.save({ transaction });

      const clubProfile = await Profile.findOne({ where: { userId: club.id }, transaction });
      const athleteProfile = await Profile.create({
        userId: user.id,
        club: clubProfile?.club || [club.firstName, club.lastName].filter(Boolean).join(' ').trim(),
        clubId: club.id,
        clubJoinedYear: new Date().getUTCFullYear(),
        position: input.position,
        age: input.age,
        ageGroup: user.getAgeGroup(),
      }, { transaction });

      const member = await ClubMember.create({
        clubId: club.id,
        athleteId: user.id,
        status: input.minor ? 'pending' : 'approved',
        teamType: input.teamType,
        competitionCategory: input.competitionCategory,
        squadGroup: input.squadGroup,
        position: input.position,
        jerseyNumber: input.jerseyNumber,
        joinedAt: input.minor ? null : new Date(),
        createdByUserId: req.user.id,
        creationSource: 'club_managed_registration',
      }, { transaction });

      if (input.minor) parentToken = await createParentConsentRequest(user, input.parentEmail, transaction);
      return { club, user, athleteProfile, membership: member };
    });
    user = result.user;
    membership = result.membership;

    let emailSent = false;
    if (input.minor && parentToken) {
      try {
        const sent = await emailParentConsent(user, parentToken);
        emailSent = Boolean(sent?.success);
      } catch (emailError) {
        console.warn('Managed athlete guardian email failed for user id:', user.id, emailError?.message || 'send failed');
      }
    }

    return res.status(201).json({
      success: true,
      athlete: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        dateOfBirth: user.dateOfBirth,
        ageGroup: result.athleteProfile.ageGroup,
      },
      membership: {
        id: membership.id,
        clubId: membership.clubId,
        status: membership.status,
        teamType: membership.teamType,
        competitionCategory: membership.competitionCategory,
        squadGroup: membership.squadGroup,
        position: membership.position,
        jerseyNumber: membership.jerseyNumber,
      },
      parentAuthorizationPending: input.minor,
      guardianEmailSent: input.minor ? emailSent : null,
      msg: input.minor
        ? emailSent ? 'Atleti u regjistrua; në pritje të autorizimit të kujdestarit.' : 'Atleti u regjistrua në mënyrë të kufizuar; emaili i autorizimit nuk u dërgua.'
        : 'Atleti u regjistrua në skuadrën e klubit.',
    });
  } catch (error) {
    if (error.status) return errorResponse(res, error.status, error.message);
    if (error?.name === 'SequelizeUniqueConstraintError') return errorResponse(res, 409, 'Ky atlet është regjistruar tashmë.');
    console.error('Managed athlete registration failed:', error?.message || error);
    return errorResponse(res, 500, 'Regjistrimi i atletit dështoi. Provo përsëri.');
  } finally {
    parentToken = null;
  }
};

exports.resendManagedAthleteConsent = async (req, res) => {
  const athleteId = Number(req.params.athleteId);
  if (!Number.isInteger(athleteId) || athleteId < 1) return errorResponse(res, 400, 'ID e atletit nuk është e vlefshme.');
  try {
    let token;
    let user;
    await sequelize.transaction(async (transaction) => {
      const membership = await ClubMember.findOne({
        where: { athleteId, creationSource: 'club_managed_registration' },
        order: [['createdAt', 'DESC']],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!membership) {
        const error = new Error('Nuk u gjet regjistrim i menaxhuar nga klubi.');
        error.status = 404;
        throw error;
      }
      const authorized = await getAuthorizedClub(req.user, membership.clubId, transaction);
      if (authorized.error) {
        const error = new Error(authorized.error.msg);
        error.status = authorized.error.status;
        throw error;
      }
      user = await User.findByPk(athleteId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!user || !isMinorAthleteRecord(user)) {
        const error = new Error('Autorizimi prindëror nuk kërkohet për këtë atlet.');
        error.status = 400;
        throw error;
      }
      const activeConsent = await GuardianConsent.findOne({ where: { minorUserId: athleteId, verifiedAt: { [Op.ne]: null }, revokedAt: null }, transaction });
      if (user.parentVerified && activeConsent) {
        const error = new Error('Autorizimi prindëror është aktiv.');
        error.status = 409;
        throw error;
      }
      if (!user.parentEmail) {
        const error = new Error('Nuk ka email të kujdestarit për ridërgim.');
        error.status = 400;
        throw error;
      }
      token = await createParentConsentRequest(user, user.parentEmail, transaction);
    });
    let emailSent = false;
    try {
      const result = await emailParentConsent(user, token);
      emailSent = Boolean(result?.success);
    } catch (err) {
      console.warn('Managed athlete guardian email resend failed for user id:', user.id, err?.message || 'send failed');
    }
    token = null;
    if (!emailSent) return res.status(503).json({ success: false, emailSent: false, parentAuthorizationPending: true, msg: 'Emaili nuk u dërgua. Provo përsëri më vonë.' });
    return res.json({ success: true, emailSent: true, parentAuthorizationPending: true, msg: 'Linku u ridërgua te kujdestari.' });
  } catch (error) {
    if (error.status) return errorResponse(res, error.status, error.message);
    console.error('Managed athlete consent resend failed:', error?.message || error);
    return errorResponse(res, 500, 'Ridërgimi i autorizimit dështoi.');
  }
};

exports.getAuthorizedClub = getAuthorizedClub;
