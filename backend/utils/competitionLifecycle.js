/**
 * Competition lifecycle. Existing rows keep legacy status values
 * (open / ongoing / finished). `lifecycle` is the canonical state.
 */

const LIFECYCLES = ['draft', 'registration', 'active', 'in_progress', 'paused', 'completed', 'cancelled'];

const COMPETITION_TYPES = ['league', 'cup', 'knockout', 'group_knockout', 'tournament'];

const GENDERS = ['open', 'male', 'female', 'mixed'];

const LEGACY_STATUS = {
  draft: 'draft',
  registration: 'open',
  active: 'ongoing',
  in_progress: 'ongoing',
  paused: 'paused',
  completed: 'finished',
  cancelled: 'cancelled',
};

const STATUS_TO_LIFECYCLE = {
  open: 'registration',
  ongoing: 'in_progress',
  finished: 'completed',
  draft: 'draft',
  registration: 'registration',
  active: 'active',
  in_progress: 'in_progress',
  paused: 'paused',
  completed: 'completed',
  cancelled: 'cancelled',
};

/** Allowed canonical transitions. Completed competitions are frozen. */
const TRANSITIONS = {
  draft: ['registration', 'cancelled'],
  registration: ['active', 'in_progress', 'draft', 'cancelled'],
  active: ['in_progress', 'paused', 'completed', 'cancelled'],
  in_progress: ['paused', 'completed', 'cancelled'],
  paused: ['active', 'in_progress', 'cancelled'],
  completed: [],
  cancelled: [],
};

function canonicalLifecycle(value) {
  if (value == null || value === '') return null;
  const key = String(value).trim().toLowerCase();
  return STATUS_TO_LIFECYCLE[key] || null;
}

function resolveLifecycle(tournament) {
  const fromColumn = canonicalLifecycle(tournament?.lifecycle);
  if (fromColumn) return fromColumn;
  return canonicalLifecycle(tournament?.status) || 'registration';
}

function legacyStatusFor(lifecycle) {
  const canonical = canonicalLifecycle(lifecycle) || lifecycle;
  return LEGACY_STATUS[canonical] || 'open';
}

function canTransition(from, to) {
  const current = canonicalLifecycle(from) || resolveLifecycle({ lifecycle: from, status: from });
  const next = canonicalLifecycle(to);
  if (!next) {
    return { ok: false, status: 400, msg: 'Unknown competition status.' };
  }
  if (current === next) return { ok: true, lifecycle: next, status: legacyStatusFor(next) };
  const allowed = TRANSITIONS[current] || [];
  if (!allowed.includes(next)) {
    return {
      ok: false,
      status: 400,
      msg: `Cannot move competition from ${current} to ${next}.`,
    };
  }
  return { ok: true, lifecycle: next, status: legacyStatusFor(next) };
}

function isRegistrationOpen(tournament) {
  return resolveLifecycle(tournament) === 'registration';
}

function isTerminal(tournament) {
  const lifecycle = resolveLifecycle(tournament);
  return lifecycle === 'completed' || lifecycle === 'cancelled';
}

function canRecordResults(tournament) {
  const lifecycle = resolveLifecycle(tournament);
  return lifecycle === 'active' || lifecycle === 'in_progress';
}

function assertResultMutation(tournament) {
  const lifecycle = resolveLifecycle(tournament);
  if (lifecycle === 'completed') {
    return { ok: false, status: 409, msg: 'Completed competition is locked. Results cannot be changed.' };
  }
  if (lifecycle === 'cancelled') {
    return { ok: false, status: 409, msg: 'Cancelled competition cannot accept results.' };
  }
  if (lifecycle === 'draft' || lifecycle === 'registration') {
    return { ok: false, status: 400, msg: 'Start the competition before recording results.' };
  }
  if (lifecycle === 'paused') {
    return { ok: false, status: 409, msg: 'Paused competition cannot accept results.' };
  }
  return { ok: true };
}

function minimumTeams(type) {
  if (type === 'group_knockout') return 4;
  return 2;
}

function assertCanStart(tournament, acceptedCount) {
  const lifecycle = resolveLifecycle(tournament);
  if (lifecycle !== 'registration' && lifecycle !== 'draft') {
    return { ok: false, status: 400, msg: 'Competition already started, finished, or cancelled.' };
  }
  if (lifecycle === 'draft') {
    return { ok: false, status: 400, msg: 'Open registration before starting the competition.' };
  }
  const needed = minimumTeams(tournament?.type);
  if (!Number.isFinite(acceptedCount) || acceptedCount < needed) {
    return {
      ok: false,
      status: 400,
      msg: `Need at least ${needed} accepted teams to start this competition.`,
    };
  }
  return { ok: true, nextLifecycle: 'active' };
}

function assertRegistration({ existingUserIds, userId, maxParticipants, tournament }) {
  if (!isRegistrationOpen(tournament)) {
    return { ok: false, status: 400, msg: 'Competition is not open for registration.' };
  }
  const ids = (existingUserIds || []).map(Number);
  if (ids.includes(Number(userId))) {
    return { ok: false, status: 409, msg: 'Already joined this tournament' };
  }
  const maxN = Number(maxParticipants);
  if (Number.isFinite(maxN) && ids.length >= maxN) {
    return { ok: false, status: 400, msg: 'Tournament full' };
  }
  return { ok: true };
}

function validateCompetitionInput(body, { partial = false } = {}) {
  const errors = [];
  const src = body || {};
  if (!partial || src.name != null) {
    if (!partial && !String(src.name || '').trim()) errors.push('Name is required.');
    if (partial && src.name != null && !String(src.name).trim()) errors.push('Name is required.');
  }
  if (src.type != null && src.type !== '' && !COMPETITION_TYPES.includes(src.type)) {
    errors.push('Invalid competition type.');
  }
  if (!partial && src.type && !COMPETITION_TYPES.includes(src.type)) {
    errors.push('Invalid competition type.');
  }
  if (src.gender != null && src.gender !== '' && !GENDERS.includes(src.gender)) {
    errors.push('Invalid gender.');
  }
  const start = src.startDate ? new Date(src.startDate) : null;
  const end = src.endDate ? new Date(src.endDate) : null;
  const deadline = src.registrationDeadline ? new Date(src.registrationDeadline) : null;
  if (src.startDate && Number.isNaN(start?.getTime())) errors.push('Start date is invalid.');
  if (src.endDate && Number.isNaN(end?.getTime())) errors.push('End date is invalid.');
  if (src.registrationDeadline && Number.isNaN(deadline?.getTime())) {
    errors.push('Registration deadline is invalid.');
  }
  if (start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end < start) {
    errors.push('End date is before start date.');
  }
  if (
    deadline &&
    start &&
    !Number.isNaN(deadline.getTime()) &&
    !Number.isNaN(start.getTime()) &&
    deadline > start
  ) {
    errors.push('Registration deadline is after the start date.');
  }
  if (src.maxParticipants != null && src.maxParticipants !== '') {
    const n = parseInt(src.maxParticipants, 10);
    if (!Number.isFinite(n) || n < 2 || n > 500) errors.push('Participants must be between 2 and 500.');
  }
  if (errors.length) return { ok: false, status: 400, msg: errors[0], errors };
  return { ok: true };
}

function slugifyCompetitionName(name, id) {
  const base = String(name || 'competition')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'competition';
  return id ? `${base}-${id}` : base;
}

module.exports = {
  LIFECYCLES,
  COMPETITION_TYPES,
  GENDERS,
  LEGACY_STATUS,
  canonicalLifecycle,
  resolveLifecycle,
  legacyStatusFor,
  canTransition,
  isRegistrationOpen,
  isTerminal,
  canRecordResults,
  assertResultMutation,
  minimumTeams,
  assertCanStart,
  assertRegistration,
  validateCompetitionInput,
  slugifyCompetitionName,
};
