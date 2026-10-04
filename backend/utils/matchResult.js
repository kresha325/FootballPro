/**
 * Official result validation, winner (regulation / extra time / penalties),
 * and match-event checks.
 */

const { knockoutRoundLabel } = require('./fixtureGenerator');

const EVENT_TYPES = [
  'goal',
  'own_goal',
  'assist',
  'yellow_card',
  'red_card',
  'substitution',
  'penalty',
  'var',
  'note',
];

function parseNonNegativeInt(value, field, { required = true, max = 99 } = {}) {
  if (value == null || value === '') {
    if (!required) return { value: null };
    return { error: `${field} is required.` };
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > max) {
    return { error: `${field} must be an integer between 0 and ${max}.` };
  }
  return { value: n };
}

function isKnockoutStage(input) {
  if (input.stage === 'group' || input.stage === 'league') return false;
  if (input.groupName) return false;
  const type = input.competitionType;
  return type === 'knockout' || type === 'cup' || type === 'tournament' || input.stage === 'knockout';
}

function winnerFromScores({
  scoreHome,
  scoreAway,
  extraTimeHome,
  extraTimeAway,
  penaltiesHome,
  penaltiesAway,
  homeUserId,
  awayUserId,
  allowDraw,
}) {
  const homeTotal = scoreHome + (extraTimeHome || 0);
  const awayTotal = scoreAway + (extraTimeAway || 0);
  if (homeTotal > awayTotal) {
    return { winnerUserId: Number(homeUserId), decidedBy: extraTimeHome || extraTimeAway ? 'extra_time' : 'regulation' };
  }
  if (awayTotal > homeTotal) {
    return { winnerUserId: Number(awayUserId), decidedBy: extraTimeHome || extraTimeAway ? 'extra_time' : 'regulation' };
  }
  if (penaltiesHome != null && penaltiesAway != null && penaltiesHome !== penaltiesAway) {
    return {
      winnerUserId: penaltiesHome > penaltiesAway ? Number(homeUserId) : Number(awayUserId),
      decidedBy: 'penalties',
    };
  }
  if (allowDraw) return { winnerUserId: null, decidedBy: 'draw' };
  return { error: 'Knockout match cannot end in a draw. Record extra time or penalties.' };
}

function scoreFromGoalEvents(events) {
  let home = 0;
  let away = 0;
  for (const event of events || []) {
    const type = event.type || 'goal';
    if (type !== 'goal' && type !== 'penalty' && type !== 'own_goal') continue;
    const scoringSide = type === 'own_goal'
      ? (event.side === 'home' ? 'away' : event.side === 'away' ? 'home' : null)
      : event.side;
    if (scoringSide === 'home') home += 1;
    else if (scoringSide === 'away') away += 1;
  }
  return { home, away };
}

function validateOfficialResult(input) {
  const homeScore = parseNonNegativeInt(input.scoreHome, 'Home score');
  const awayScore = parseNonNegativeInt(input.scoreAway, 'Away score');
  if (homeScore.error || awayScore.error) {
    return { ok: false, status: 400, msg: homeScore.error || awayScore.error };
  }
  const halfHome = parseNonNegativeInt(input.halfTimeHome, 'Half-time home score', { required: false });
  const halfAway = parseNonNegativeInt(input.halfTimeAway, 'Half-time away score', { required: false });
  const extraHome = parseNonNegativeInt(input.extraTimeHome, 'Extra-time home goals', { required: false });
  const extraAway = parseNonNegativeInt(input.extraTimeAway, 'Extra-time away goals', { required: false });
  const penHome = parseNonNegativeInt(input.penaltiesHome, 'Home penalties', { required: false, max: 30 });
  const penAway = parseNonNegativeInt(input.penaltiesAway, 'Away penalties', { required: false, max: 30 });
  const optionalErrors = [halfHome, halfAway, extraHome, extraAway, penHome, penAway].filter((x) => x.error);
  if (optionalErrors.length) return { ok: false, status: 400, msg: optionalErrors[0].error };

  if (halfHome.value != null && halfHome.value > homeScore.value) {
    return { ok: false, status: 400, msg: 'Half-time home score cannot exceed the full-time score.' };
  }
  if (halfAway.value != null && halfAway.value > awayScore.value) {
    return { ok: false, status: 400, msg: 'Half-time away score cannot exceed the full-time score.' };
  }
  if ((penHome.value == null) !== (penAway.value == null)) {
    return { ok: false, status: 400, msg: 'Record both penalty scores, or neither.' };
  }
  if ((extraHome.value == null) !== (extraAway.value == null)) {
    return { ok: false, status: 400, msg: 'Record extra-time goals for both teams, or neither.' };
  }
  if (!input.homeUserId || (input.awayUserId == null && !input.allowBye)) {
    return { ok: false, status: 400, msg: 'Both teams are required.' };
  }
  if (Number(input.homeUserId) === Number(input.awayUserId)) {
    return { ok: false, status: 400, msg: 'A team cannot play itself.' };
  }

  const events = Array.isArray(input.goalEvents) ? input.goalEvents : null;
  if (events && events.length) {
    const normalized = events.map((event) => ({ ...event, type: event.type || 'goal' }));
    const sided = normalized.filter((event) => event.side === 'home' || event.side === 'away');
    if (sided.length === normalized.length) {
      const summed = scoreFromGoalEvents(normalized);
      const homeTotal = homeScore.value + (extraHome.value || 0);
      const awayTotal = awayScore.value + (extraAway.value || 0);
      if (summed.home !== homeTotal || summed.away !== awayTotal) {
        return {
          ok: false,
          status: 400,
          msg: 'Goal events do not match the official score.',
        };
      }
    }
  }

  const decision = winnerFromScores({
    scoreHome: homeScore.value,
    scoreAway: awayScore.value,
    extraTimeHome: extraHome.value,
    extraTimeAway: extraAway.value,
    penaltiesHome: penHome.value,
    penaltiesAway: penAway.value,
    homeUserId: input.homeUserId,
    awayUserId: input.awayUserId,
    allowDraw: !isKnockoutStage(input),
  });
  if (decision.error) return { ok: false, status: 400, msg: decision.error };

  return {
    ok: true,
    patch: {
      scoreHome: homeScore.value,
      scoreAway: awayScore.value,
      halfTimeHome: halfHome.value,
      halfTimeAway: halfAway.value,
      extraTimeHome: extraHome.value,
      extraTimeAway: extraAway.value,
      penaltiesHome: penHome.value,
      penaltiesAway: penAway.value,
      winnerUserId: decision.winnerUserId,
      decidedBy: decision.decidedBy,
      status: 'finished',
    },
  };
}

function eventKey(event) {
  return [
    event.type,
    event.userId || '',
    event.relatedUserId || '',
    event.minute ?? '',
    event.side || '',
    event.detail || '',
  ].join('|');
}

function validateMatchEvent(event, match) {
  if (!event || !EVENT_TYPES.includes(event.type)) {
    return { ok: false, status: 400, msg: 'Invalid match event type.' };
  }
  const minute = event.minute == null || event.minute === '' ? null : Number(event.minute);
  if (minute != null && (!Number.isInteger(minute) || minute < 0 || minute > 130)) {
    return { ok: false, status: 400, msg: 'Event minute must be between 0 and 130.' };
  }
  const needsPlayer = !['var', 'note'].includes(event.type);
  const userId = event.userId == null || event.userId === '' ? null : Number(event.userId);
  if (needsPlayer && !Number.isFinite(userId)) {
    return { ok: false, status: 400, msg: 'A player is required for this event.' };
  }
  if (event.type === 'substitution') {
    const related = Number(event.relatedUserId);
    if (!Number.isFinite(related)) {
      return { ok: false, status: 400, msg: 'Substitution needs the player coming on.' };
    }
    if (related === userId) {
      return { ok: false, status: 400, msg: 'Substitution cannot use the same player twice.' };
    }
    if (minute == null) return { ok: false, status: 400, msg: 'Substitution minute is required.' };
  }
  if (event.type === 'note' || event.type === 'var') {
    if (!String(event.detail || '').trim()) {
      return { ok: false, status: 400, msg: 'A note is required for this event.' };
    }
  }
  const side = event.side === 'home' || event.side === 'away' ? event.side : null;
  if (needsPlayer && !side) {
    return { ok: false, status: 400, msg: 'Event side must be home or away.' };
  }
  if (match && Number(match.homeUserId) === Number(match.awayUserId)) {
    return { ok: false, status: 400, msg: 'Match teams are invalid.' };
  }
  return {
    ok: true,
    event: {
      type: event.type,
      userId: Number.isFinite(userId) ? userId : null,
      relatedUserId: event.relatedUserId == null || event.relatedUserId === '' ? null : Number(event.relatedUserId),
      side,
      minute,
      detail: event.detail ? String(event.detail).slice(0, 500) : null,
      eventKey: eventKey({
        type: event.type,
        userId,
        relatedUserId: event.relatedUserId,
        minute,
        side,
        detail: event.detail || '',
      }),
    },
  };
}

function winnerOfStoredMatch(match) {
  if (!match) return null;
  if (match.winnerUserId) return Number(match.winnerUserId);
  if (match.walkover && match.homeUserId) return Number(match.homeUserId);
  if (match.scoreHome == null || match.scoreAway == null || match.awayUserId == null) return null;
  const decision = winnerFromScores({
    scoreHome: Number(match.scoreHome) || 0,
    scoreAway: Number(match.scoreAway) || 0,
    extraTimeHome: match.extraTimeHome == null ? null : Number(match.extraTimeHome),
    extraTimeAway: match.extraTimeAway == null ? null : Number(match.extraTimeAway),
    penaltiesHome: match.penaltiesHome == null ? null : Number(match.penaltiesHome),
    penaltiesAway: match.penaltiesAway == null ? null : Number(match.penaltiesAway),
    homeUserId: match.homeUserId,
    awayUserId: match.awayUserId,
    allowDraw: true,
  });
  return decision.winnerUserId || null;
}

function planKnockoutAdvancement(roundMatches) {
  const matches = [...(roundMatches || [])];
  if (!matches.length) return { ok: false, reason: 'no_matches' };
  const ordered = matches.sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0) || (Number(a.id) || 0) - (Number(b.id) || 0));
  for (const match of ordered) {
    const status = match.status;
    const done = status === 'finished' || status === 'walkover' || match.walkover;
    if (!done) return { ok: false, reason: 'round_incomplete' };
    if (!winnerOfStoredMatch(match)) return { ok: false, reason: 'undecided_match', matchId: match.id };
  }
  const winners = ordered.map((match) => winnerOfStoredMatch(match));
  const round = (Number(ordered[0].round) || 1) + 1;
  if (winners.length === 1) {
    return { ok: true, championUserId: winners[0], fixtures: [] };
  }
  const fixtures = [];
  for (let i = 0; i < winners.length; i += 2) {
    if (i + 1 >= winners.length) {
      fixtures.push({
        round,
        roundLabel: knockoutRoundLabel(1),
        homeUserId: winners[i],
        awayUserId: null,
        stage: 'knockout',
        groupName: null,
        walkover: true,
        winnerUserId: winners[i],
        status: 'walkover',
      });
    } else {
      fixtures.push({
        round,
        roundLabel: knockoutRoundLabel(winners.length),
        homeUserId: winners[i],
        awayUserId: winners[i + 1],
        stage: 'knockout',
        groupName: null,
        walkover: false,
        status: 'scheduled',
      });
    }
  }
  return { ok: true, fixtures, championUserId: null };
}

module.exports = {
  EVENT_TYPES,
  parseNonNegativeInt,
  isKnockoutStage,
  winnerFromScores,
  scoreFromGoalEvents,
  validateOfficialResult,
  validateMatchEvent,
  eventKey,
  winnerOfStoredMatch,
  planKnockoutAdvancement,
};
