'use strict';

const { ageFromDateOnly } = require('./registerValidation');
const { COACHING_STAFF_ROLES, isActiveCoachAssignment, isVerifiedClub } = require('./managedAthleteRegistration');
const { Op } = require('sequelize');

const CHANNELS = Object.freeze({
  DIRECT_MESSAGE: 'direct_message',
  GROUP_MESSAGE: 'group_message',
  VIDEO_CALL: 'video_call',
  PRIVATE_LIVE_INVITATION: 'private_live_invitation',
  GUARDIAN_MEDIATED_GROUP: 'guardian_mediated_group',
});

function isMinorAthlete(user) {
  if (String(user?.role || '').toLowerCase() !== 'athlete' || !user?.dateOfBirth) return false;
  const age = ageFromDateOnly(user.dateOfBirth);
  return Number.isFinite(age) && age < 18;
}

function scopeChannels(scope) {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) return [];
  if (Array.isArray(scope.channels)) return scope.channels.map((item) => String(item));
  return scope.channel ? [String(scope.channel)] : [];
}

function scopeMatches(scope, { adultUserId, clubId, channel }) {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) return false;
  if (Number(scope.adultUserId) !== Number(adultUserId)) return false;
  if (!scopeChannels(scope).includes(channel)) return false;
  return clubId == null || Number(scope.clubId) === Number(clubId);
}

async function activeGuardianConsents(GuardianConsent, minorUserId) {
  return GuardianConsent.findAll({
    where: {
      minorUserId: Number(minorUserId),
      consentPurpose: 'minor_account_authorization',
      verifiedAt: { [Op.ne]: null },
      revokedAt: null,
    },
  });
}

async function isVerifiedGuardian({ actor, minor, GuardianConsent }) {
  const rows = await activeGuardianConsents(GuardianConsent, minor.id);
  const email = String(actor?.email || '').trim().toLowerCase();
  return rows.some((consent) => {
    if (!consent.verifiedAt || consent.revokedAt) return false;
    return Number(consent.guardianUserId) === Number(actor.id) ||
      (!!email && String(consent.guardianEmail || '').trim().toLowerCase() === email &&
        !!consent.guardianName && ['parent', 'legal_guardian'].includes(String(consent.relationship || '').toLowerCase()));
  });
}

async function hasCommunicationConsent({ GuardianConsent, minorUserId, adultUserId, channel, clubId = null }) {
  const rows = await GuardianConsent.findAll({
    where: {
      minorUserId: Number(minorUserId),
      consentPurpose: 'minor_communication',
      verifiedAt: { [Op.ne]: null },
      revokedAt: null,
    },
  });
  return rows.some((row) => row.verifiedAt && !row.revokedAt &&
    scopeMatches(row.consentScope, { adultUserId, clubId, channel }));
}

async function authorizedCoachClub({ adult, minor, User, ClubMember, ClubStaff }) {
  if (String(adult?.role || '').toLowerCase() !== 'coach') return null;
  const memberships = await ClubMember.findAll({
    where: { athleteId: Number(minor.id), status: 'approved', leftAt: null },
  });
  for (const membership of memberships) {
    const clubId = Number(membership.clubId);
    if (!Number.isInteger(clubId) || clubId < 1) continue;
    const club = await User.findByPk(clubId, {
      attributes: ['id', 'role', 'adminVerified', 'deletedAt', 'bannedAt'],
    });
    if (!isVerifiedClub(club)) continue;
    const assignments = await ClubStaff.findAll({
      where: { clubId, staffId: Number(adult.id), status: 'active' },
    });
    if (assignments.some((assignment) =>
      COACHING_STAFF_ROLES.has(String(assignment.staffRole || '').toLowerCase()) &&
      isActiveCoachAssignment(adult, assignment, clubId))) return clubId;
  }
  return null;
}

/**
 * Authorize a private communication between two accounts. Existing base
 * guardian consent never grants professional contact; an explicit, active
 * consent row naming both the adult and channel is required.
 */
async function authorizeMinorDirectContact({
  actorId,
  targetId,
  channel,
  User,
  ClubMember,
  ClubStaff,
  GuardianConsent,
}) {
  const actor = await User.findByPk(Number(actorId), { attributes: ['id', 'role', 'email', 'dateOfBirth', 'deletedAt', 'bannedAt'] });
  const target = await User.findByPk(Number(targetId), { attributes: ['id', 'role', 'email', 'dateOfBirth', 'deletedAt', 'bannedAt'] });
  if (!actor || !target || actor.deletedAt || target.deletedAt || actor.bannedAt || target.bannedAt) {
    return { allowed: false, status: 404, reason: 'USER_UNAVAILABLE' };
  }
  const actorMinor = isMinorAthlete(actor);
  const targetMinor = isMinorAthlete(target);
  if (!actorMinor && !targetMinor) return { allowed: true };
  if (actorMinor && targetMinor) return { allowed: true };

  const minor = actorMinor ? actor : target;
  const adult = actorMinor ? target : actor;
  if (await isVerifiedGuardian({ actor: adult, minor, GuardianConsent })) return { allowed: true, relationship: 'guardian' };

  const clubId = await authorizedCoachClub({ adult, minor, User, ClubMember, ClubStaff });
  if (clubId && await hasCommunicationConsent({
    GuardianConsent,
    minorUserId: minor.id,
    adultUserId: adult.id,
    clubId,
    channel,
  })) return { allowed: true, relationship: 'authorized_coach', clubId };

  return { allowed: false, status: 403, reason: 'GUARDIAN_COMMUNICATION_CONSENT_REQUIRED' };
}

/**
 * Group messages require an explicit per-adult grant. Non-coach adults must
 * also share the group with the verified guardian whose consent covers them.
 */
async function authorizeMinorGroupCommunication({
  actorId,
  memberIds,
  channel = CHANNELS.GROUP_MESSAGE,
  User,
  ClubMember,
  ClubStaff,
  GuardianConsent,
}) {
  const ids = [...new Set((memberIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  if (!ids.includes(Number(actorId))) ids.push(Number(actorId));
  const members = await User.findAll({ where: { id: ids }, attributes: ['id', 'role', 'email', 'dateOfBirth', 'adminVerified', 'deletedAt', 'bannedAt'] });
  const byId = new Map(members.map((user) => [Number(user.id), user]));
  if (ids.some((id) => !byId.has(id))) return { allowed: false, status: 404, reason: 'USER_UNAVAILABLE' };

  const minors = members.filter(isMinorAthlete);
  const adults = members.filter((user) => !isMinorAthlete(user));
  for (const minor of minors) {
    const guardians = [];
    for (const adult of adults) {
      if (await isVerifiedGuardian({ actor: adult, minor, GuardianConsent })) {
        guardians.push(adult);
        continue;
      }
      const direct = await authorizeMinorDirectContact({
        actorId: adult.id,
        targetId: minor.id,
        channel,
        User,
        ClubMember,
        ClubStaff,
        GuardianConsent,
      });
      if (direct.allowed) continue;

      // Scouts/agents and coaches without direct-contact approval require a
      // guardian-mediated group and a separate grant for this exact adult.
      const guardianPresent = await Promise.all(adults.map((candidate) =>
        isVerifiedGuardian({ actor: candidate, minor, GuardianConsent })
      ));
      const hasGuardian = guardianPresent.some(Boolean);
      let eligibleProfessional = false;
      let grantClubId = null;
      const adultRole = String(adult.role || '').toLowerCase();
      if (adultRole === 'coach') {
        grantClubId = await authorizedCoachClub({ adult, minor, User, ClubMember, ClubStaff });
        eligibleProfessional = Boolean(grantClubId);
      } else if (['scout', 'manager'].includes(adultRole)) {
        eligibleProfessional = adult.adminVerified === true;
      }
      const mediatedGrant = hasGuardian && eligibleProfessional && await hasCommunicationConsent({
        GuardianConsent,
        minorUserId: minor.id,
        adultUserId: adult.id,
        channel: CHANNELS.GUARDIAN_MEDIATED_GROUP,
        clubId: grantClubId,
      });
      if (!mediatedGrant) return { allowed: false, status: 403, reason: 'GUARDIAN_MEDIATED_GROUP_REQUIRED' };
    }
  }
  return { allowed: true };
}

async function authorizeConversationCommunication({
  conversationId,
  actorId,
  channel = CHANNELS.DIRECT_MESSAGE,
  Conversation,
  ConversationMember,
  User,
  ClubMember,
  ClubStaff,
  GuardianConsent,
}) {
  const conversation = await Conversation.findByPk(conversationId, { attributes: ['id', 'isGroup'] });
  if (!conversation) return { allowed: false, status: 404, reason: 'CONVERSATION_NOT_FOUND' };
  const members = await ConversationMember.findAll({
    where: { conversationId },
    attributes: ['userId'],
  });
  const memberIds = members.map((member) => Number(member.userId));
  if (!memberIds.includes(Number(actorId))) return { allowed: false, status: 403, reason: 'NOT_A_CONVERSATION_MEMBER' };
  if (conversation.isGroup || memberIds.length > 2) {
    return authorizeMinorGroupCommunication({
      actorId,
      memberIds,
      channel: channel === CHANNELS.VIDEO_CALL ? CHANNELS.VIDEO_CALL : CHANNELS.GROUP_MESSAGE,
      User,
      ClubMember,
      ClubStaff,
      GuardianConsent,
    });
  }
  const otherId = memberIds.find((id) => id !== Number(actorId));
  if (!otherId) return { allowed: true };
  return authorizeMinorDirectContact({
    actorId,
    targetId: otherId,
    channel: channel === CHANNELS.VIDEO_CALL ? CHANNELS.VIDEO_CALL : CHANNELS.DIRECT_MESSAGE,
    User,
    ClubMember,
    ClubStaff,
    GuardianConsent,
  });
}

module.exports = {
  CHANNELS,
  isMinorAthlete,
  scopeMatches,
  hasCommunicationConsent,
  authorizeMinorDirectContact,
  authorizeMinorGroupCommunication,
  authorizeConversationCommunication,
};
