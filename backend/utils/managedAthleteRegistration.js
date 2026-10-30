'use strict';

const { parseDateOnly, ageFromDateOnly } = require('./registerValidation');
const { assignSquadGroup } = require('./squadGroup');
const { can } = require('../services/admin/rbac');

const COACHING_STAFF_ROLES = new Set([
  'head_coach',
  'assistant_coach',
  'fitness_coach',
  'goalkeeper_coach',
  'technical_coach',
  'tactical_coach',
  'academy_director',
  'youth_director',
]);
const TEAM_TYPES = new Set([
  'first_team', 'youth', 'women', 'men', 'u23', 'u21', 'u19', 'u17', 'u15', 'u13', 'u11', 'u9',
]);
const COMPETITION_CATEGORIES = new Set([
  'open', 'senior', 'u23', 'u21', 'u19', 'u17', 'u15', 'u13', 'u11', 'u10', 'u9',
]);

function normalizeName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function validateManagedAthleteInput(body = {}) {
  const firstName = normalizeName(body.firstName);
  const lastName = normalizeName(body.lastName);
  if (!firstName || firstName.length > 100 || !lastName || lastName.length > 100) {
    return { ok: false, status: 400, message: 'Emri dhe mbiemri janë të detyrueshëm (deri në 100 karaktere).' };
  }

  const dob = parseDateOnly(body.dateOfBirth);
  if (!dob.valid) return { ok: false, status: 400, message: 'Datëlindja duhet të jetë datë e vlefshme në formatin YYYY-MM-DD.' };
  const age = ageFromDateOnly(dob.value);
  if (age < 6 || age > 120) return { ok: false, status: 400, message: 'Datëlindja nuk është brenda moshës së lejuar.' };

  const teamTypeRaw = body.teamType == null || body.teamType === '' ? null : String(body.teamType).trim().toLowerCase();
  const categoryRaw = body.competitionCategory == null || body.competitionCategory === ''
    ? null
    : String(body.competitionCategory).trim().toLowerCase().replace(/\s+/g, '');
  const competitionCategory = categoryRaw || 'open';
  if (teamTypeRaw && !TEAM_TYPES.has(teamTypeRaw)) {
    return { ok: false, status: 400, message: 'Ekipi i zgjedhur nuk është i vlefshëm.' };
  }
  if (categoryRaw && !COMPETITION_CATEGORIES.has(categoryRaw) && !/^u\d{1,2}$/.test(categoryRaw)) {
    return { ok: false, status: 400, message: 'Grupmosha e garës nuk është e vlefshme.' };
  }

  let squadGroup = body.squadGroup == null || body.squadGroup === '' ? null : String(body.squadGroup).trim().toUpperCase();
  if (squadGroup && !['A', 'B', 'C'].includes(squadGroup)) {
    return { ok: false, status: 400, message: 'Grupi duhet të jetë A, B ose C.' };
  }
  const memberForGroupCheck = { competitionCategory, squadGroup };
  const groupResult = assignSquadGroup(memberForGroupCheck, squadGroup);
  if (!groupResult.ok) return { ok: false, status: 400, message: groupResult.msg };
  squadGroup = memberForGroupCheck.squadGroup;

  const teamType = teamTypeRaw || (
    competitionCategory.startsWith('u')
      ? (TEAM_TYPES.has(competitionCategory) ? competitionCategory : 'youth')
      : 'first_team'
  );
  const position = body.position == null || body.position === '' ? null : normalizeName(body.position);
  if (position && position.length > 80) return { ok: false, status: 400, message: 'Pozicioni është tepër i gjatë.' };
  let jerseyNumber = null;
  if (body.jerseyNumber != null && body.jerseyNumber !== '') {
    jerseyNumber = Number(body.jerseyNumber);
    if (!Number.isInteger(jerseyNumber) || jerseyNumber < 1 || jerseyNumber > 99) {
      return { ok: false, status: 400, message: 'Numri i fanellës duhet të jetë mes 1 dhe 99.' };
    }
  }

  const parentEmail = body.parentEmail == null || body.parentEmail === ''
    ? null
    : String(body.parentEmail).trim().toLowerCase();
  if (parentEmail && (parentEmail.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail))) {
    return { ok: false, status: 400, message: 'Email-i i kujdestarit nuk është i vlefshëm.' };
  }
  const minor = age < 18;
  if (minor && !parentEmail) {
    return { ok: false, status: 400, message: 'Email-i i prindit ose kujdestarit kërkohet për atletët nën 18 vjeç.' };
  }

  return {
    ok: true,
    value: {
      firstName,
      lastName,
      dateOfBirth: dob.value,
      age,
      minor,
      parentEmail,
      teamType,
      competitionCategory: competitionCategory === 'open' ? null : competitionCategory,
      squadGroup,
      position,
      jerseyNumber,
    },
  };
}

function isActiveCoachAssignment(actor, assignment, clubId, now = new Date()) {
  if (String(actor?.role || '').toLowerCase() !== 'coach' || !assignment) return false;
  if (Number(assignment.clubId) !== Number(clubId) || Number(assignment.staffId) !== Number(actor.id)) return false;
  if (assignment.status !== 'active' || assignment.leftAt) return false;
  if (!COACHING_STAFF_ROLES.has(String(assignment.staffRole || '').toLowerCase())) return false;
  if (assignment.contractUntil) {
    const expiry = new Date(assignment.contractUntil);
    if (!Number.isFinite(expiry.getTime()) || expiry < now) return false;
  }
  return true;
}

function isVerifiedClub(club) {
  return Boolean(
    club &&
    String(club.role || '').toLowerCase() === 'club' &&
    club.adminVerified === true &&
    !club.deletedAt &&
    !club.bannedAt
  );
}

function canAdminRegisterAthlete(actor) {
  return String(actor?.role || '').toLowerCase() === 'admin' && can(actor, 'players.manage');
}

function isMinorAthleteRecord(user) {
  return String(user?.role || '').toLowerCase() === 'athlete' &&
    user?.dateOfBirth && ageFromDateOnly(user.dateOfBirth) < 18;
}

module.exports = {
  COACHING_STAFF_ROLES,
  TEAM_TYPES,
  COMPETITION_CATEGORIES,
  validateManagedAthleteInput,
  isActiveCoachAssignment,
  isVerifiedClub,
  canAdminRegisterAthlete,
  isMinorAthleteRecord,
};
