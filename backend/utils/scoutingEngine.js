'use strict';

/**
 * Scouting rules that do not touch the database.
 * Global performance uses official match totals and profile facts.
 * Scout evaluation uses only the signed-in scout's saved preferences.
 * Those two scores are never stored as if they were the same number.
 */

const { positionGroup } = require('./playerProfileCv');
const { footballSeasonFromDate, isValidLeagueSeason } = require('./footballSeason');

const RATING_MIN = 1;
const RATING_MAX = 10;
const GLOBAL_WEIGHT = 0.75;
const SCOUT_WEIGHT = 0.25;
const PAGE_MAX = 40;

const TECHNICAL_KEYS = ['passing', 'firstTouch', 'dribbling', 'crossing', 'finishing', 'shooting', 'tackling', 'ballControl'];
const PHYSICAL_KEYS = ['speed', 'acceleration', 'stamina', 'strength', 'agility'];
const TACTICAL_KEYS = ['positioning', 'decisionMaking', 'awareness', 'movement', 'tacticalDiscipline'];
const MENTAL_KEYS = ['composure', 'concentration', 'workRate', 'leadership', 'mentality'];

const POSITION_CRITERIA = {
  goalkeeper: ['shotStopping', 'distribution', 'commandOfArea', 'oneOnOnes'],
  defender: ['marking', 'aerialAbility', 'defensivePositioning', 'buildUp'],
  midfielder: ['passingRange', 'pressing', 'ballRetention', 'vision'],
  winger: ['oneVsOne', 'delivery', 'offBallMovement', 'endProduct'],
  forward: ['movementInBox', 'holdUpPlay', 'finishingComposure', 'pressingFromFront'],
  other: ['roleExecution', 'gameImpact'],
};

const RECOMMENDATIONS = ['WATCH', 'SHORTLIST', 'CONTACT', 'TRIAL', 'SIGN', 'PASS'];
const SHORTLIST_STATUSES = ['NEW', 'WATCHING', 'SHORTLISTED', 'CONTACTED', 'TRIAL', 'OFFER', 'SIGNED', 'REJECTED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const ACTIVE_SHORTLIST = new Set(['NEW', 'WATCHING', 'SHORTLISTED', 'CONTACTED', 'TRIAL', 'OFFER']);
const REPORT_STATUSES = ['draft', 'completed'];
const COMPARE_WINDOWS = ['season', 'career', 'last5', 'last10'];
const FEET = ['left', 'right', 'both'];
const POSITION_GROUPS = ['goalkeeper', 'defender', 'midfielder', 'winger', 'forward'];

const POSITION_PATTERNS = {
  goalkeeper: ['%goal%', '%gk%', '%portier%', '%golman%'],
  defender: ['%defend%', '%back%', '%mbrojt%'],
  midfielder: ['%mid%', '%mesfush%'],
  winger: ['%winger%', '%wing%', '%krah%'],
  forward: ['%forward%', '%striker%', '%sulm%', '%attack%'],
};

function round1(value) {
  return Math.round(Number(value) * 10) / 10;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function cleanText(value, max) {
  if (value == null) return null;
  const text = String(value).replace(/\u0000/g, '').trim();
  if (!text) return null;
  return text.slice(0, max);
}

function parsePage(query = {}, { maxLimit = PAGE_MAX, defaultLimit = 20 } = {}) {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (page > 10000) page = 10000;
  if (!Number.isFinite(limit) || limit < 1) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;
  return { page, limit, offset: (page - 1) * limit };
}

function optionalNumber(value, { min = 0, max = 100000 } = {}) {
  if (value == null || value === '') return { ok: true, value: null };
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return { ok: false };
  return { ok: true, value: n };
}

function parseRating(value) {
  if (value == null || value === '') return { ok: true, value: null };
  const n = Number(value);
  if (!Number.isFinite(n)) return { ok: false, msg: 'Vlerësimi duhet të jetë numër.' };
  const rounded = round1(n);
  if (rounded < RATING_MIN || rounded > RATING_MAX) {
    return { ok: false, msg: `Vlerësimi duhet të jetë nga ${RATING_MIN} deri në ${RATING_MAX}.` };
  }
  return { ok: true, value: rounded };
}

function pickCriteria(input, allowed) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const out = {};
  for (const key of Object.keys(source)) {
    if (!allowed.includes(key)) {
      return { ok: false, msg: `Kriter i panjohur: ${key}` };
    }
  }
  for (const key of allowed) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    const parsed = parseRating(source[key]);
    if (!parsed.ok) return parsed;
    if (parsed.value != null) out[key] = parsed.value;
  }
  return { ok: true, value: out };
}

function average(values) {
  if (!values.length) return null;
  return round1(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function reportPositionGroup(position) {
  const value = String(position || '').toLowerCase();
  if (/winger|krah|\bwing\b/.test(value)) return 'winger';
  return positionGroup(position) || 'other';
}

function criteriaForPosition(position) {
  const group = reportPositionGroup(position);
  return { group, keys: POSITION_CRITERIA[group] || POSITION_CRITERIA.other };
}

function validateReportPayload(body = {}, position) {
  const { group, keys } = criteriaForPosition(position);
  const technical = pickCriteria(body.technical, TECHNICAL_KEYS);
  if (!technical.ok) return { ok: false, field: 'technical', msg: technical.msg };
  const physical = pickCriteria(body.physical, PHYSICAL_KEYS);
  if (!physical.ok) return { ok: false, field: 'physical', msg: physical.msg };
  const tactical = pickCriteria(body.tactical, TACTICAL_KEYS);
  if (!tactical.ok) return { ok: false, field: 'tactical', msg: tactical.msg };
  const mental = pickCriteria(body.mental, MENTAL_KEYS);
  if (!mental.ok) return { ok: false, field: 'mental', msg: mental.msg };
  const positionSpecific = pickCriteria(body.positionSpecific, keys);
  if (!positionSpecific.ok) return { ok: false, field: 'positionSpecific', msg: positionSpecific.msg };

  const potential = parseRating(body.potentialRating);
  if (!potential.ok) return { ok: false, field: 'potentialRating', msg: potential.msg };

  let recommendation = body.recommendation == null || body.recommendation === ''
    ? null
    : String(body.recommendation).trim().toUpperCase();
  if (recommendation && !RECOMMENDATIONS.includes(recommendation)) {
    return { ok: false, field: 'recommendation', msg: 'Rekomandimi nuk është i vlefshëm.' };
  }

  const status = String(body.status || 'draft').trim().toLowerCase();
  if (!REPORT_STATUSES.includes(status)) {
    return { ok: false, field: 'status', msg: 'Statusi i raportit duhet të jetë draft ose completed.' };
  }

  const strengths = cleanText(body.strengths, 4000);
  const weaknesses = cleanText(body.weaknesses, 4000);
  const potentialText = cleanText(body.potential, 4000);
  const notes = cleanText(body.notes, 4000);

  const technicalRating = average(Object.values(technical.value));
  const physicalRating = average(Object.values(physical.value));
  const tacticalRating = average(Object.values(tactical.value));
  const mentalRating = average(Object.values(mental.value));
  const specificRating = average(Object.values(positionSpecific.value));
  const parts = [technicalRating, physicalRating, tacticalRating, mentalRating, specificRating, potential.value]
    .filter((value) => value != null);
  const overallRating = average(parts);

  const hasContent = parts.length > 0 || recommendation || strengths || weaknesses || potentialText || notes;
  if (!hasContent) {
    return { ok: false, field: 'report', msg: 'Raporti është bosh. Shto të paktën një vlerësim, shënim ose rekomandim.' };
  }
  if (status === 'completed' && !recommendation) {
    return { ok: false, field: 'recommendation', msg: 'Raporti i përfunduar kërkon një rekomandim.' };
  }

  let reportDate = body.reportDate ? String(body.reportDate).slice(0, 10) : new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate) || Number.isNaN(new Date(`${reportDate}T00:00:00Z`).getTime())) {
    return { ok: false, field: 'reportDate', msg: 'Data e raportit nuk është e vlefshme.' };
  }

  return {
    ok: true,
    value: {
      reportDate,
      status,
      positionGroup: group,
      technical: technical.value,
      physical: physical.value,
      tactical: tactical.value,
      mental: mental.value,
      positionSpecific: positionSpecific.value,
      strengths,
      weaknesses,
      potential: potentialText,
      potentialRating: potential.value,
      recommendation,
      notes,
      technicalRating,
      physicalRating,
      tacticalRating,
      mentalRating,
      overallRating,
    },
  };
}

function sameUtcDay(left, right) {
  const a = new Date(left);
  const b = new Date(right);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false;
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

function isDuplicateReport(existing, incoming) {
  if (!existing) return false;
  if (incoming.matchId && Number(existing.matchId) === Number(incoming.matchId)) return true;
  if (!incoming.matchId && !existing.matchId && sameUtcDay(existing.createdAt || existing.reportDate, new Date())) {
    return true;
  }
  return false;
}

function normalizeEnum(value, allowed, fallback) {
  if (value == null || value === '') return fallback;
  const next = String(value).trim().toUpperCase();
  if (!allowed.includes(next)) return null;
  return next;
}

function validateShortlistPatch(body = {}, { partial = false } = {}) {
  const status = normalizeEnum(body.status, SHORTLIST_STATUSES, partial ? undefined : 'NEW');
  if (body.status != null && body.status !== '' && status == null) {
    return { ok: false, field: 'status', msg: 'Statusi i shortlistës nuk është i vlefshëm.' };
  }
  const priority = normalizeEnum(body.priority, PRIORITIES, partial ? undefined : 'MEDIUM');
  if (body.priority != null && body.priority !== '' && priority == null) {
    return { ok: false, field: 'priority', msg: 'Prioriteti nuk është i vlefshëm.' };
  }
  let followUpDate = undefined;
  if (Object.prototype.hasOwnProperty.call(body, 'followUpDate')) {
    if (body.followUpDate == null || body.followUpDate === '') followUpDate = null;
    else {
      const day = String(body.followUpDate).slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
        return { ok: false, field: 'followUpDate', msg: 'Data e ndjekjes nuk është e vlefshme.' };
      }
      followUpDate = day;
    }
  }
  const patch = {};
  if (status !== undefined) patch.status = status;
  if (priority !== undefined) patch.priority = priority;
  if (Object.prototype.hasOwnProperty.call(body, 'note')) patch.note = cleanText(body.note, 4000);
  if (followUpDate !== undefined) patch.followUpDate = followUpDate;
  return { ok: true, value: patch };
}

function readPhysical(stats) {
  const source = stats && typeof stats === 'object' && !Array.isArray(stats) ? stats : {};
  const height = source.height == null || source.height === '' ? null : Number(source.height);
  const weight = source.weight == null || source.weight === '' ? null : Number(source.weight);
  const foot = source.preferredFoot ? String(source.preferredFoot).toLowerCase() : null;
  return {
    height: Number.isFinite(height) ? height : null,
    weight: Number.isFinite(weight) ? weight : null,
    preferredFoot: FEET.includes(foot) ? foot : null,
    playingLevel: source.playingLevel ? String(source.playingLevel).slice(0, 120) : null,
    footballCategory: source.footballCategory ? String(source.footballCategory).slice(0, 120) : null,
    yearsExperience: source.yearsExperience == null || source.yearsExperience === '' ? null : Number(source.yearsExperience) || null,
  };
}

function factor(key, label, points, max) {
  return { key, label, points: round1(points), max, available: true };
}

function scaled(factors) {
  const max = factors.reduce((sum, item) => sum + item.max, 0);
  const raw = factors.reduce((sum, item) => sum + item.points, 0);
  if (max <= 0) return null;
  return round1((raw / max) * 100);
}

function hasOfficialNumbers(official) {
  return Boolean(
    official &&
      (Number(official.appearances) > 0 ||
        Number(official.minutes) > 0 ||
        Number(official.goals) > 0 ||
        Number(official.assists) > 0 ||
        official.rating != null)
  );
}

function rankAthlete({ official = null, form = null, completenessPercent = null, verified = null, scout = null } = {}) {
  const appearances = Number(official?.appearances) || 0;
  const goals = Number(official?.goals) || 0;
  const assists = Number(official?.assists) || 0;
  const minutes = Number(official?.minutes) || 0;
  const rating = official?.rating == null || official.rating === '' ? null : Number(official.rating);
  const hasMatches = hasOfficialNumbers(official);
  const globalFactors = [];

  if (hasMatches && rating != null && Number.isFinite(rating)) {
    globalFactors.push(factor('rating', 'Match rating', (clamp(rating, 0, 10) / 10) * 30, 30));
  }
  if (hasMatches) {
    const goalBasis = minutes >= 90 ? (goals / minutes) * 90 : goals;
    const assistBasis = minutes >= 90 ? (assists / minutes) * 90 : assists;
    globalFactors.push(factor('goals', minutes >= 90 ? 'Goals per 90' : 'Goals', clamp(goalBasis * 6, 0, 20), 20));
    globalFactors.push(factor('assists', minutes >= 90 ? 'Assists per 90' : 'Assists', clamp(assistBasis * 5, 0, 15), 15));
    globalFactors.push(factor('minutes', 'Minutes played', clamp((minutes / 900) * 15, 0, 15), 15));
  }

  const last5Apps = Number(form?.last5?.appearances) || 0;
  if (last5Apps >= 3) {
    const formRating = form.last5.rating == null ? null : Number(form.last5.rating);
    const formPoints = formRating != null && Number.isFinite(formRating)
      ? (clamp(formRating, 0, 10) / 10) * 10
      : clamp((Number(form.last5.goals) + Number(form.last5.assists)) * 2, 0, 10);
    globalFactors.push(factor('form', 'Recent form (last 5 matches)', formPoints, 10));
  }

  if (completenessPercent != null && Number.isFinite(Number(completenessPercent))) {
    globalFactors.push(factor('completeness', 'Profile completeness', (clamp(Number(completenessPercent), 0, 100) / 100) * 5, 5));
  }
  if (verified === true || verified === false) {
    globalFactors.push(factor('verified', 'Verified profile', verified ? 5 : 0, 5));
  }

  const globalScore = scaled(globalFactors);
  const prefs = scout || {};
  const wantedPositions = [
    ...(Array.isArray(prefs.positions) ? prefs.positions : []),
    prefs.position,
  ].map((item) => String(item || '').trim()).filter(Boolean);
  const countries = (Array.isArray(prefs.countries) ? prefs.countries : [])
    .map((item) => String(item || '').trim().toLowerCase())
    .filter(Boolean);
  const hasPrefs = Boolean(
    wantedPositions.length ||
      prefs.minAge != null ||
      prefs.maxAge != null ||
      countries.length ||
      prefs.foot
  );

  let scoutScore = null;
  const scoutFactors = [];
  if (hasPrefs) {
    if (wantedPositions.length) {
      const playerPos = String(prefs.playerPosition || '');
      const playerGroup = reportPositionGroup(playerPos);
      const matched = wantedPositions.some((wanted) => {
        const wantedGroup = POSITION_GROUPS.includes(String(wanted).toLowerCase())
          ? String(wanted).toLowerCase()
          : reportPositionGroup(wanted);
        return playerPos.toLowerCase() === String(wanted).toLowerCase() || (playerGroup && playerGroup === wantedGroup);
      });
      scoutFactors.push(factor('position', 'Preferred position', matched ? 40 : 0, 40));
    }
    if (prefs.minAge != null || prefs.maxAge != null) {
      const age = prefs.playerAge == null ? null : Number(prefs.playerAge);
      if (age != null && Number.isFinite(age)) {
        const minOk = prefs.minAge == null || age >= Number(prefs.minAge);
        const maxOk = prefs.maxAge == null || age <= Number(prefs.maxAge);
        scoutFactors.push(factor('age', 'Age range', minOk && maxOk ? 25 : 0, 25));
      }
    }
    if (countries.length) {
      const country = String(prefs.playerCountry || '').toLowerCase();
      scoutFactors.push(factor('country', 'Preferred country', country && countries.some((item) => country.includes(item)) ? 20 : 0, 20));
    }
    if (prefs.foot) {
      const foot = String(prefs.playerFoot || '').toLowerCase();
      scoutFactors.push(factor('foot', 'Preferred foot', foot && foot === String(prefs.foot).toLowerCase() ? 15 : 0, 15));
    }
    scoutScore = scaled(scoutFactors);
  }

  let score = globalScore;
  let blend = null;
  if (globalScore != null && scoutScore != null) {
    score = round1(globalScore * GLOBAL_WEIGHT + scoutScore * SCOUT_WEIGHT);
    blend = {
      globalWeight: GLOBAL_WEIGHT,
      scoutWeight: SCOUT_WEIGHT,
      score,
      note: 'Blend of official performance and this scout’s preferences. The two parts are listed separately.',
    };
  } else if (globalScore == null && scoutScore != null) {
    score = scoutScore;
    blend = {
      globalWeight: 0,
      scoutWeight: 1,
      score,
      note: 'No official match data. This number is preference fit only, not a performance score.',
    };
  } else if (globalScore != null && hasMatches) {
    blend = {
      globalWeight: 1,
      scoutWeight: 0,
      score: globalScore,
      note: 'No scout preferences saved. This number is official performance only.',
    };
  }
  if (!hasMatches && scoutScore == null) {
    score = null;
    blend = {
      globalWeight: 0,
      scoutWeight: 0,
      score: null,
      note: 'No official match data. Profile completeness is not treated as a performance score.',
    };
  }

  return {
    score: score == null ? null : score,
    maxScore: 100,
    percentage: score == null ? null : Math.round(score),
    insufficientMatchData: !hasMatches,
    appearances,
    reasons: globalFactors.filter((item) => item.points > 0).map((item) => item.label),
    ranking: {
      globalPerformance: {
        score: hasMatches ? globalScore : null,
        maxScore: 100,
        factors: globalFactors,
        source: 'official-matches-and-profile',
        insufficientMatchData: !hasMatches,
      },
      scoutEvaluation: scoutScore == null ? null : {
        score: scoutScore,
        maxScore: 100,
        factors: scoutFactors,
        source: 'scout-preferences',
      },
      blend,
    },
  };
}

function comparisonPeriod({ window, season, now = new Date() } = {}) {
  const mode = COMPARE_WINDOWS.includes(window) ? window : 'season';
  if (mode === 'career') return { window: 'career', season: null, label: 'Career' };
  if (mode === 'last5') return { window: 'last5', season: null, label: 'Last 5 matches' };
  if (mode === 'last10') return { window: 'last10', season: null, label: 'Last 10 matches' };
  const requested = String(season || '').trim();
  const resolved = isValidLeagueSeason(requested) || /^\d{4}$/.test(requested) ? requested : footballSeasonFromDate(now);
  return { window: 'season', season: resolved, label: `Season ${resolved}` };
}

function statsForPeriod(report, period) {
  const empty = {
    appearances: 0,
    minutes: 0,
    goals: 0,
    assists: 0,
    yellowCards: 0,
    redCards: 0,
    rating: null,
    insufficient: true,
    sampleSize: 0,
  };
  if (!report?.hasOfficial) return empty;
  let source = report.season;
  if (period.window === 'career') source = report.career;
  if (period.window === 'last5') source = report.form?.last5;
  if (period.window === 'last10') source = report.form?.last10;
  const sampleSize = Number(source?.appearances) || 0;
  const expected = period.window === 'last5' ? 5 : period.window === 'last10' ? 10 : 1;
  return {
    appearances: sampleSize,
    minutes: Number(source?.minutes) || 0,
    goals: Number(source?.goals) || 0,
    assists: Number(source?.assists) || 0,
    yellowCards: Number(source?.yellowCards) || 0,
    redCards: Number(source?.redCards) || 0,
    rating: source?.rating == null ? null : Number(source.rating),
    insufficient: sampleSize < expected,
    sampleSize,
  };
}

function trendFor(report, window) {
  const lines = Array.isArray(report?.trend) ? report.trend : [];
  const count = window === 'last5' ? 5 : window === 'last10' ? 10 : lines.length;
  const slice = window === 'season' || window === 'career' ? lines : lines.slice(0, count);
  return {
    window,
    sampleSize: slice.length,
    insufficient: window === 'last5' ? slice.length < 5 : window === 'last10' ? slice.length < 10 : slice.length === 0,
    matches: slice.map((line) => ({
      matchId: line.matchId,
      date: line.date || null,
      competition: line.competition || null,
      goals: Number(line.goals) || 0,
      assists: Number(line.assists) || 0,
      minutes: Number(line.minutes) || 0,
      rating: line.rating == null ? null : Number(line.rating),
      result: line.result || null,
    })),
  };
}

function diffWatchSnapshot(previous, current) {
  if (!previous?.initialized || !current) return [];
  const events = [];
  if ((previous.club || current.club) && previous.club !== current.club) {
    events.push({
      type: 'club',
      summary: previous.club
        ? `Club changed from ${previous.club} to ${current.club || 'unknown'}`
        : `New club: ${current.club}`,
      payload: { from: previous.club, to: current.club },
    });
  }
  const seen = new Set((previous.competitionIds || []).map((id) => Number(id)));
  for (const id of current.competitionIds || []) {
    const competitionId = Number(id);
    if (!competitionId || seen.has(competitionId)) continue;
    const name = (current.competitions || []).find((item) => Number(item.id) === competitionId)?.name || null;
    events.push({
      type: 'competition',
      summary: name ? `New competition: ${name}` : 'New competition',
      payload: { competitionId, name },
    });
  }
  if (current.latestMatchId && Number(current.latestMatchId) !== Number(previous.latestMatchId || 0)) {
    events.push({
      type: 'match',
      summary: 'New match recorded',
      payload: { matchId: Number(current.latestMatchId) },
    });
  }
  const goalDelta = Number(current.goals || 0) - Number(previous.goals || 0);
  const assistDelta = Number(current.assists || 0) - Number(previous.assists || 0);
  if (goalDelta > 0 || assistDelta > 0) {
    events.push({
      type: 'performance',
      summary: 'Official goals or assists increased',
      payload: { goals: goalDelta > 0 ? goalDelta : 0, assists: assistDelta > 0 ? assistDelta : 0 },
    });
  } else if (
    previous.rating != null &&
    current.rating != null &&
    Number(current.rating) >= Number(previous.rating) + 0.2
  ) {
    events.push({
      type: 'performance',
      summary: 'Average match rating improved',
      payload: { from: Number(previous.rating), to: Number(current.rating) },
    });
  }
  if (Number(current.achievementCount || 0) > Number(previous.achievementCount || 0)) {
    events.push({ type: 'achievement', summary: 'New achievement on the public profile' });
  }
  if (Number(current.videoCount || 0) > Number(previous.videoCount || 0)) {
    events.push({ type: 'video', summary: 'New public video' });
  }
  return events;
}

function parseIdList(value, { min = 2, max = 4 } = {}) {
  const raw = Array.isArray(value) ? value : String(value || '').split(',');
  const ids = [...new Set(raw.map((item) => Number(item)).filter((id) => Number.isInteger(id) && id > 0))];
  if (ids.length < min || ids.length > max) return { ok: false, ids };
  return { ok: true, ids };
}

function positionPatterns(position) {
  const key = String(position || '').trim().toLowerCase();
  if (!key) return null;
  if (POSITION_PATTERNS[key]) return POSITION_PATTERNS[key];
  return [`%${key.replace(/[%_]/g, '')}%`];
}

function meta() {
  return {
    positions: POSITION_GROUPS,
    feet: FEET,
    recommendationOptions: RECOMMENDATIONS,
    shortlistStatuses: SHORTLIST_STATUSES,
    priorities: PRIORITIES,
    reportStatuses: REPORT_STATUSES,
    compareWindows: COMPARE_WINDOWS,
    ratingScale: { min: RATING_MIN, max: RATING_MAX, step: 0.1 },
    criteria: {
      technical: TECHNICAL_KEYS,
      physical: PHYSICAL_KEYS,
      tactical: TACTICAL_KEYS,
      mental: MENTAL_KEYS,
      positionSpecific: POSITION_CRITERIA,
    },
    scoring: {
      globalWeight: GLOBAL_WEIGHT,
      scoutWeight: SCOUT_WEIGHT,
      note: 'Global performance comes from official matches, profile completeness and verification. Scout evaluation comes only from saved preferences. They are returned separately.',
    },
  };
}

function ownsRecord(ownerId, userId) {
  return Number(ownerId) === Number(userId);
}

const PRIVATE_CARD_KEYS = [
  'email',
  'phone',
  'password',
  'contact',
  'parentEmail',
  'parentVerificationToken',
  'resetPasswordToken',
  'notes',
];

function omitPrivateFields(card) {
  const next = { ...(card || {}) };
  for (const key of PRIVATE_CARD_KEYS) delete next[key];
  return next;
}

module.exports = {
  ACTIVE_SHORTLIST,
  COMPARE_WINDOWS,
  FEET,
  GLOBAL_WEIGHT,
  MENTAL_KEYS,
  PAGE_MAX,
  PHYSICAL_KEYS,
  POSITION_CRITERIA,
  POSITION_GROUPS,
  POSITION_PATTERNS,
  PRIORITIES,
  RECOMMENDATIONS,
  SCOUT_WEIGHT,
  SHORTLIST_STATUSES,
  TACTICAL_KEYS,
  TECHNICAL_KEYS,
  average,
  cleanText,
  comparisonPeriod,
  criteriaForPosition,
  diffWatchSnapshot,
  isDuplicateReport,
  meta,
  optionalNumber,
  omitPrivateFields,
  ownsRecord,
  parseIdList,
  parsePage,
  parseRating,
  positionPatterns,
  rankAthlete,
  readPhysical,
  reportPositionGroup,
  sameUtcDay,
  statsForPeriod,
  trendFor,
  validateReportPayload,
  validateShortlistPatch,
};
