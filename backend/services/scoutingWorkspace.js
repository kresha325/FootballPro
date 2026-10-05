'use strict';

const { Op, QueryTypes, UniqueConstraintError, fn, col } = require('sequelize');
const sequelize = require('../config/database');
const User = require('../models/User');
const Profile = require('../models/Profile');
const Match = require('../models/Match');
const { Tournament } = require('../models/Tournament');
const PlayerMatchStat = require('../models/PlayerMatchStat');
const MediaItem = require('../models/MediaItem');
const Notification = require('../models/Notification');
const ScoutShortlist = require('../models/ScoutShortlist');
const ScoutWatchlist = require('../models/ScoutWatchlist');
const ScoutWatchEvent = require('../models/ScoutWatchEvent');
const ScoutingReport = require('../models/ScoutingReport');
const ScoutPreference = require('../models/ScoutPreference');
const { hasTier } = require('../utils/subscriptionAccess');
const { effectiveVerified } = require('../utils/userVerification');
const { profileNationality, profileCompletenessScore } = require('../utils/profileFields');
const { buildPerformanceReport, loadBundle } = require('../utils/playerProfileCv');
const {
  ACTIVE_SHORTLIST,
  FEET,
  POSITION_GROUPS,
  cleanText,
  comparisonPeriod,
  criteriaForPosition,
  diffWatchSnapshot,
  isDuplicateReport,
  meta,
  optionalNumber,
  ownsRecord,
  omitPrivateFields,
  parseIdList,
  parsePage,
  positionPatterns,
  rankAthlete,
  readPhysical,
  statsForPeriod,
  trendFor,
  validateReportPayload,
  validateShortlistPatch,
} = require('../utils/scoutingEngine');

const WORKSPACE_ROLES = new Set(['scout', 'club', 'manager']);
const USER_FIELDS = ['id', 'firstName', 'lastName', 'role', 'clubVerified', 'parentVerified', 'dateOfBirth', 'premium', 'createdAt', 'verified'];
const PROFILE_FIELDS = ['position', 'club', 'clubId', 'country', 'city', 'age', 'ageGroup', 'profilePhoto', 'stats', 'bio', 'achievements', 'coverPhoto', 'clubJoinedYear'];
const STAT_ID_CAP = 2000;

function denied(user) {
  const role = String(user?.role || '').toLowerCase();
  if (!WORKSPACE_ROLES.has(role)) {
    return { status: 403, body: { msg: 'Qasja u refuzua. Kërkohet roli Scout, Club ose Manager.' } };
  }
  if (!hasTier(user, 'pro')) {
    return {
      status: 403,
      body: {
        msg: 'Scouting kërkon planin Pro.',
        code: 'PLAN_REQUIRED',
        requiredTier: 'pro',
        effectiveTier: user.effectiveTier || 'free',
      },
    };
  }
  return null;
}

function playerName(user) {
  return `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || `Player ${user?.id || ''}`.trim();
}

function decimal(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : null;
}

function presentReport(row) {
  const plain = row.get ? row.get({ plain: true }) : row;
  return {
    ...plain,
    potentialRating: decimal(plain.potentialRating),
    technicalRating: decimal(plain.technicalRating),
    physicalRating: decimal(plain.physicalRating),
    tacticalRating: decimal(plain.tacticalRating),
    mentalRating: decimal(plain.mentalRating),
    overallRating: decimal(plain.overallRating),
    player: plain.player ? { id: plain.player.id, playerName: playerName(plain.player), profilePhoto: plain.player.Profile?.profilePhoto || null, position: plain.player.Profile?.position || null } : undefined,
  };
}

async function preferenceRow(scoutId) {
  return ScoutPreference.findOne({ where: { scoutId } });
}

function preferenceView(row, profile) {
  const positions = Array.isArray(row?.positions) ? row.positions : [];
  if (!positions.length && profile?.position) positions.push(profile.position);
  return {
    positions,
    minAge: row?.minAge ?? null,
    maxAge: row?.maxAge ?? null,
    countries: Array.isArray(row?.countries) ? row.countries : [],
    foot: row?.foot || null,
    competitionLevel: row?.competitionLevel || null,
    position: profile?.position || null,
  };
}

function scoutFitInput(prefs, player) {
  const physical = readPhysical(player?.Profile?.stats);
  return {
    ...prefs,
    playerPosition: player?.Profile?.position || null,
    playerAge: player?.Profile?.age ?? null,
    playerCountry: player?.Profile?.country || null,
    playerFoot: physical.preferredFoot,
  };
}

function presentPlayer(user, report, { ranking, shortlisted, watchlisted, period } = {}) {
  const profile = user.Profile || {};
  const physical = readPhysical(profile.stats);
  const completeness = profileCompletenessScore(profile, { user, official: report?.career || null });
  const currentPeriod = period || comparisonPeriod({});
  const seasonStats = report ? statsForPeriod(report, currentPeriod.window === 'season' ? currentPeriod : comparisonPeriod({})) : null;
  const career = report?.hasOfficial ? report.career : null;
  return omitPrivateFields({
    playerId: user.id,
    playerName: playerName(user),
    age: profile.age ?? null,
    nationality: profileNationality(profile),
    position: profile.position || null,
    club: profile.club || null,
    city: profile.city || null,
    country: profile.country || null,
    profilePhoto: profile.profilePhoto || null,
    preferredFoot: physical.preferredFoot,
    height: physical.height,
    weight: physical.weight,
    playingLevel: physical.playingLevel,
    footballCategory: physical.footballCategory,
    yearsExperience: Number.isFinite(physical.yearsExperience) ? physical.yearsExperience : null,
    verified: effectiveVerified(user),
    completeness,
    shortlisted: Boolean(shortlisted),
    watchlisted: Boolean(watchlisted),
    period: currentPeriod,
    seasonStats,
    career: career
      ? {
          appearances: career.appearances,
          minutes: career.minutes,
          goals: career.goals,
          assists: career.assists,
          yellowCards: career.yellowCards,
          redCards: career.redCards,
          rating: career.rating,
          label: 'Career',
        }
      : null,
    form: report?.hasOfficial
      ? {
          last5: statsForPeriod(report, { window: 'last5', label: 'Last 5 matches' }),
          last10: statsForPeriod(report, { window: 'last10', label: 'Last 10 matches' }),
        }
      : null,
    trend: report ? trendFor(report, 'last10') : { window: 'last10', sampleSize: 0, insufficient: true, matches: [] },
    performanceScore: ranking?.ranking?.globalPerformance?.score ?? null,
    score: ranking?.score ?? null,
    maxScore: 100,
    percentage: ranking?.percentage ?? null,
    reasons: ranking?.reasons || [],
    ranking: ranking?.ranking || null,
    insufficientMatchData: ranking?.insufficientMatchData !== false,
    stats: {
      goals: career?.goals || 0,
      assists: career?.assists || 0,
      appearances: career?.appearances || 0,
      matches: career?.appearances || 0,
      minutes: career?.minutes || 0,
      rating: career?.rating ?? null,
    },
    premium: Boolean(user.premium),
  });
}

async function flagsFor(scoutId, playerIds) {
  if (!playerIds.length) return { shortlist: new Set(), watch: new Set() };
  const [shortRows, watchRows] = await Promise.all([
    ScoutShortlist.findAll({ where: { scoutId, playerId: { [Op.in]: playerIds } }, attributes: ['playerId'], raw: true }),
    ScoutWatchlist.findAll({ where: { scoutId, playerId: { [Op.in]: playerIds } }, attributes: ['playerId'], raw: true }),
  ]);
  return {
    shortlist: new Set(shortRows.map((row) => Number(row.playerId))),
    watch: new Set(watchRows.map((row) => Number(row.playerId))),
  };
}

async function videoCounts(playerIds) {
  if (!playerIds.length) return {};
  try {
    const rows = await MediaItem.findAll({
      attributes: ['playerId', [fn('COUNT', col('id')), 'count']],
      where: {
        playerId: { [Op.in]: playerIds },
        visibility: 'public',
      },
      group: ['playerId'],
      raw: true,
    });
    const map = {};
    for (const row of rows) map[Number(row.playerId)] = Number(row.count) || 0;
    return map;
  } catch (err) {
    console.warn('scouting video counts:', err?.message || err);
    return {};
  }
}

function snapshotFrom(profile, report, videoCount) {
  const career = report?.career || {};
  const competitions = (report?.competitions || [])
    .filter((item) => item?.id)
    .map((item) => ({ id: Number(item.id), name: item.name || null }));
  const latest = Array.isArray(report?.trend) ? report.trend[0] : null;
  return {
    initialized: true,
    club: profile?.club || null,
    competitionIds: competitions.map((item) => item.id),
    competitions,
    latestMatchId: latest?.matchId || null,
    goals: Number(career.goals) || 0,
    assists: Number(career.assists) || 0,
    appearances: Number(career.appearances) || 0,
    rating: career.rating == null ? null : Number(career.rating),
    achievementCount: Array.isArray(profile?.achievements) ? profile.achievements.length : 0,
    videoCount: Number(videoCount) || 0,
  };
}

async function athletesByIds(ids) {
  if (!ids.length) return [];
  const users = await User.findAll({
    where: { id: { [Op.in]: ids }, role: 'athlete', deletedAt: null, bannedAt: null },
    attributes: USER_FIELDS,
    include: [{ model: Profile, required: false, attributes: PROFILE_FIELDS }],
  });
  const order = new Map(ids.map((id, index) => [Number(id), index]));
  return users.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

async function enrich(scoutId, users, prefs) {
  const ids = users.map((user) => user.id);
  const [bundle, flags] = await Promise.all([loadBundle(ids), flagsFor(scoutId, ids)]);
  const period = comparisonPeriod({});
  return users.map((user) => {
    const report = buildPerformanceReport({
      userId: user.id,
      position: user.Profile?.position,
      ...bundle,
    });
    const ranking = rankAthlete({
      official: report.hasOfficial ? report.career : null,
      form: report.form,
      completenessPercent: profileCompletenessScore(user.Profile, { user, official: report.career }).percent,
      verified: effectiveVerified(user),
      scout: scoutFitInput(prefs, user),
    });
    return {
      user,
      report,
      card: presentPlayer(user, report, {
        ranking,
        shortlisted: flags.shortlist.has(Number(user.id)),
        watchlisted: flags.watch.has(Number(user.id)),
        period,
      }),
    };
  });
}

async function performanceIds(filters) {
  const needs = ['minAppearances', 'minGoals', 'minAssists', 'minMinutes', 'minRating', 'competition', 'season']
    .some((key) => filters[key] != null && filters[key] !== '');
  if (!needs) return null;
  const replacements = { cap: STAT_ID_CAP };
  let sql = `
    SELECT pms."userId" AS "userId"
    FROM "PlayerMatchStats" pms
    JOIN "Matches" m ON m.id = pms."matchId"
    LEFT JOIN "Tournaments" t ON t.id = m."tournamentId"
    WHERE 1=1
  `;
  if (filters.season) {
    sql += ' AND t.season = :season';
    replacements.season = filters.season;
  }
  if (filters.competition) {
    sql += ' AND t.name ILIKE :competition';
    replacements.competition = `%${String(filters.competition).replace(/[%_]/g, '')}%`;
  }
  sql += ' GROUP BY pms."userId" HAVING 1=1';
  if (filters.minAppearances) {
    sql += ' AND COUNT(pms.id) >= :minAppearances';
    replacements.minAppearances = filters.minAppearances;
  }
  if (filters.minGoals) {
    sql += ' AND SUM(pms.goals) >= :minGoals';
    replacements.minGoals = filters.minGoals;
  }
  if (filters.minAssists) {
    sql += ' AND SUM(pms.assists) >= :minAssists';
    replacements.minAssists = filters.minAssists;
  }
  if (filters.minMinutes) {
    sql += ' AND SUM(pms.minutes) >= :minMinutes';
    replacements.minMinutes = filters.minMinutes;
  }
  if (filters.minRating) {
    sql += ' AND AVG(pms.rating) >= :minRating';
    replacements.minRating = filters.minRating;
  }
  sql += ' ORDER BY SUM(pms.goals) DESC, AVG(pms.rating) DESC NULLS LAST LIMIT :cap';
  const rows = await sequelize.query(sql, { replacements, type: QueryTypes.SELECT });
  return {
    ids: rows.map((row) => Number(row.userId)).filter((id) => id > 0),
    capped: rows.length >= STAT_ID_CAP,
  };
}

function likeFilter(value) {
  return `%${String(value).trim().replace(/[%_]/g, '').slice(0, 80)}%`;
}

function jsonNumeric(field, op, value) {
  return sequelize.where(
    sequelize.literal(`NULLIF("Profile"."stats"->>'${field}','')::numeric`),
    { [op]: value }
  );
}

async function discover(user, query) {
  const block = denied(user);
  if (block) return block;
  const page = parsePage(query);
  const q = cleanText(query.q || query.name || query.search, 80);
  const position = cleanText(query.position, 40);
  const country = cleanText(query.country || query.nationality, 80);
  const city = cleanText(query.city, 80);
  const club = cleanText(query.club, 80);
  const foot = query.foot ? String(query.foot).trim().toLowerCase() : '';
  if (foot && !FEET.includes(foot)) return { status: 400, body: { msg: 'Këmba duhet të jetë left, right ose both.' } };

  const ranges = {};
  for (const [key, bounds] of Object.entries({
    minAge: { min: 8, max: 60 },
    maxAge: { min: 8, max: 60 },
    minHeight: { min: 100, max: 250 },
    maxHeight: { min: 100, max: 250 },
    minWeight: { min: 30, max: 200 },
    maxWeight: { min: 30, max: 200 },
    minExperience: { min: 0, max: 40 },
    minAppearances: { min: 0, max: 2000 },
    minGoals: { min: 0, max: 2000 },
    minAssists: { min: 0, max: 2000 },
    minMinutes: { min: 0, max: 200000 },
    minRating: { min: 0, max: 10 },
    minRecentRating: { min: 0, max: 10 },
  })) {
    const parsed = optionalNumber(query[key], bounds);
    if (!parsed.ok) return { status: 400, body: { msg: `Filtri ${key} nuk është i vlefshëm.` } };
    if (parsed.value != null && parsed.value > 0) ranges[key] = parsed.value;
  }
  if (ranges.minAge != null && ranges.maxAge != null && ranges.minAge > ranges.maxAge) {
    return { status: 400, body: { msg: 'Mosha minimale është më e madhe se ajo maksimale.' } };
  }

  const season = cleanText(query.season, 16);
  const competition = cleanText(query.competition, 80);
  const playingLevel = cleanText(query.playingLevel, 80);
  const category = cleanText(query.category || query.footballCategory, 80);

  let statFilter = null;
  try {
    statFilter = await performanceIds({ ...ranges, season, competition });
  } catch (err) {
    console.warn('scouting performance filter:', err?.message || err);
    return { status: 500, body: { msg: 'Filtri i performancës dështoi.' } };
  }

  const profileWhere = {};
  const profileAnd = [];
  if (ranges.minAge != null || ranges.maxAge != null) {
    profileWhere.age = {};
    if (ranges.minAge != null) profileWhere.age[Op.gte] = ranges.minAge;
    if (ranges.maxAge != null) profileWhere.age[Op.lte] = ranges.maxAge;
  }
  if (country) profileWhere.country = { [Op.iLike]: likeFilter(country) };
  if (city) profileWhere.city = { [Op.iLike]: likeFilter(city) };
  if (club) profileWhere.club = { [Op.iLike]: likeFilter(club) };
  const patterns = positionPatterns(position);
  if (patterns) {
    profileAnd.push({ [Op.or]: patterns.map((pattern) => ({ position: { [Op.iLike]: pattern } })) });
  }
  if (foot) profileAnd.push(sequelize.where(sequelize.fn('lower', sequelize.literal(`COALESCE("Profile"."stats"->>'preferredFoot','')`)), foot));
  if (playingLevel) profileAnd.push(sequelize.where(sequelize.fn('lower', sequelize.literal(`COALESCE("Profile"."stats"->>'playingLevel','')`)), { [Op.like]: likeFilter(playingLevel).toLowerCase() }));
  if (category) profileAnd.push(sequelize.where(sequelize.fn('lower', sequelize.literal(`COALESCE("Profile"."stats"->>'footballCategory','')`)), { [Op.like]: likeFilter(category).toLowerCase() }));
  if (ranges.minHeight != null) profileAnd.push(jsonNumeric('height', Op.gte, ranges.minHeight));
  if (ranges.maxHeight != null) profileAnd.push(jsonNumeric('height', Op.lte, ranges.maxHeight));
  if (ranges.minWeight != null) profileAnd.push(jsonNumeric('weight', Op.gte, ranges.minWeight));
  if (ranges.maxWeight != null) profileAnd.push(jsonNumeric('weight', Op.lte, ranges.maxWeight));
  if (ranges.minExperience != null) profileAnd.push(jsonNumeric('yearsExperience', Op.gte, ranges.minExperience));
  if (profileAnd.length) profileWhere[Op.and] = profileAnd;

  const userWhere = { role: 'athlete', deletedAt: null, bannedAt: null };
  if (statFilter) userWhere.id = { [Op.in]: statFilter.ids.length ? statFilter.ids : [0] };
  if (q) {
    const pattern = likeFilter(q);
    userWhere[Op.or] = [
      { firstName: { [Op.iLike]: pattern } },
      { lastName: { [Op.iLike]: pattern } },
      sequelize.where(
        sequelize.fn('concat', sequelize.col('User.firstName'), ' ', sequelize.col('User.lastName')),
        { [Op.iLike]: pattern }
      ),
    ];
  }

  const include = [{ model: Profile, required: true, attributes: PROFILE_FIELDS, where: profileWhere }];
  const prefRow = await preferenceRow(user.id);
  const profile = await Profile.findOne({ where: { userId: user.id }, attributes: ['position'] });
  const prefs = preferenceView(prefRow, profile);

  if (ranges.minRecentRating != null) {
    const candidates = await User.findAll({
      where: userWhere,
      attributes: ['id'],
      include,
      limit: 201,
      subQuery: false,
    });
    if (candidates.length > 200) {
      return { status: 400, body: { msg: 'Ngushto filtrat para se të filtroni formën e fundit. Kërkimi përputhet me më shumë se 200 lojtarë.' } };
    }
    const enriched = await enrich(user.id, await athletesByIds(candidates.map((row) => row.id)), prefs);
    const matched = enriched.filter((item) => {
      const last5 = item.card.form?.last5;
      return last5 && !last5.insufficient && last5.rating != null && Number(last5.rating) >= ranges.minRecentRating;
    });
    const slice = matched.slice(page.offset, page.offset + page.limit);
    return {
      status: 200,
      body: {
        page: page.page,
        limit: page.limit,
        total: matched.length,
        capped: Boolean(statFilter?.capped),
        players: slice.map((item) => item.card),
      },
    };
  }

  const total = await User.count({ where: userWhere, include, distinct: true });
  const users = await User.findAll({
    where: userWhere,
    attributes: USER_FIELDS,
    include,
    limit: page.limit,
    offset: page.offset,
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
    subQuery: false,
  });
  const enriched = await enrich(user.id, users, prefs);
  return {
    status: 200,
    body: {
      page: page.page,
      limit: page.limit,
      total,
      capped: Boolean(statFilter?.capped),
      players: enriched.map((item) => item.card),
    },
  };
}

async function recommendationPool(position) {
  let leaderIds = [];
  try {
    const rows = await sequelize.query(
      `
        SELECT "userId" AS "userId"
        FROM "PlayerMatchStats"
        GROUP BY "userId"
        ORDER BY AVG(rating) DESC NULLS LAST, SUM(goals) DESC
        LIMIT 40
      `,
      { type: QueryTypes.SELECT }
    );
    leaderIds = rows.map((row) => Number(row.userId)).filter((id) => id > 0);
  } catch (err) {
    console.warn('scouting leaders:', err?.message || err);
  }
  const patterns = positionPatterns(position);
  const profileWhere = patterns
    ? { [Op.or]: patterns.map((pattern) => ({ position: { [Op.iLike]: pattern } })) }
    : {};
  const recent = await User.findAll({
    where: { role: 'athlete', deletedAt: null, bannedAt: null },
    attributes: ['id'],
    include: [{ model: Profile, required: true, attributes: ['id'], where: profileWhere }],
    limit: 40,
    order: [['createdAt', 'DESC']],
    subQuery: false,
  });
  return [...new Set([...leaderIds, ...recent.map((row) => row.id)])].slice(0, 80);
}

async function recommendations(user, query) {
  const block = denied(user);
  if (block) return block;
  const page = parsePage(query, { defaultLimit: 20, maxLimit: 40 });
  const minScore = optionalNumber(query.minScore, { min: 0, max: 100 });
  if (!minScore.ok) return { status: 400, body: { msg: 'Pikët minimale nuk janë të vlefshme.' } };
  const profile = await Profile.findOne({ where: { userId: user.id } });
  if (!profile) return { status: 404, body: { msg: 'Profili nuk u gjet' } };
  const prefRow = await preferenceRow(user.id);
  const prefs = preferenceView(prefRow, profile);
  const position = cleanText(query.position, 40) || (prefs.positions[0] || '');
  const ids = await recommendationPool(position);
  const users = await athletesByIds(ids);
  const enriched = await enrich(user.id, users, prefs);
  let ranked = enriched
    .map((item) => item.card)
    .filter((card) => card.score != null && (minScore.value == null || card.score >= minScore.value));
  ranked.sort((a, b) => (b.score || 0) - (a.score || 0));
  const slice = ranked.slice(0, page.limit);
  return {
    status: 200,
    body: {
      total: ranked.length,
      displayed: slice.length,
      recommendations: slice,
      filters: { position: position || 'all', minScore: minScore.value || 0 },
      scoring: meta().scoring,
    },
  };
}

async function playerCard(user, playerId) {
  const block = denied(user);
  if (block) return block;
  const id = Number(playerId);
  if (!Number.isInteger(id) || id <= 0) return { status: 400, body: { msg: 'Lojtari nuk është i vlefshëm.' } };
  const athlete = await User.findOne({
    where: { id, role: 'athlete', deletedAt: null, bannedAt: null },
    attributes: USER_FIELDS,
    include: [{ model: Profile, required: true, attributes: PROFILE_FIELDS }],
  });
  if (!athlete) return { status: 404, body: { msg: 'Lojtari nuk u gjet.' } };
  const profile = await Profile.findOne({ where: { userId: user.id }, attributes: ['position'] });
  const prefs = preferenceView(await preferenceRow(user.id), profile);
  const [card] = await enrich(user.id, [athlete], prefs);
  const { group, keys } = criteriaForPosition(athlete.Profile?.position);
  return { status: 200, body: { player: card.card, positionCriteria: { group, keys } } };
}

async function getPreferences(user) {
  const block = denied(user);
  if (block) return block;
  const profile = await Profile.findOne({ where: { userId: user.id }, attributes: ['position'] });
  const row = await preferenceRow(user.id);
  return { status: 200, body: preferenceView(row, profile) };
}

async function savePreferences(user, body = {}) {
  const block = denied(user);
  if (block) return block;
  const positions = (Array.isArray(body.positions) ? body.positions : [])
    .map((item) => cleanText(item, 40))
    .filter(Boolean)
    .slice(0, 8);
  for (const position of positions) {
    const group = String(position).toLowerCase();
    if (POSITION_GROUPS.includes(group)) continue;
    if (position.length < 2) return { status: 400, body: { msg: 'Pozicioni i preferuar nuk është i vlefshëm.' } };
  }
  const minAge = optionalNumber(body.minAge, { min: 8, max: 60 });
  const maxAge = optionalNumber(body.maxAge, { min: 8, max: 60 });
  if (!minAge.ok || !maxAge.ok) return { status: 400, body: { msg: 'Intervali i moshës nuk është i vlefshëm.' } };
  if (minAge.value != null && maxAge.value != null && minAge.value > maxAge.value) {
    return { status: 400, body: { msg: 'Mosha minimale është më e madhe se ajo maksimale.' } };
  }
  const countries = (Array.isArray(body.countries) ? body.countries : [])
    .map((item) => cleanText(item, 60))
    .filter(Boolean)
    .slice(0, 8);
  const foot = body.foot ? String(body.foot).trim().toLowerCase() : null;
  if (foot && !FEET.includes(foot)) return { status: 400, body: { msg: 'Këmba duhet të jetë left, right ose both.' } };
  const payload = {
    positions,
    minAge: minAge.value,
    maxAge: maxAge.value,
    countries,
    foot,
    competitionLevel: cleanText(body.competitionLevel, 80),
  };
  const existing = await preferenceRow(user.id);
  if (existing) await existing.update(payload);
  else await ScoutPreference.create({ scoutId: user.id, ...payload });
  return getPreferences(user);
}

async function requireAthlete(playerId) {
  const id = Number(playerId);
  if (!Number.isInteger(id) || id <= 0) return null;
  return User.findOne({
    where: { id, role: 'athlete', deletedAt: null, bannedAt: null },
    attributes: ['id', 'firstName', 'lastName'],
    include: [{ model: Profile, required: false, attributes: PROFILE_FIELDS }],
  });
}

async function listShortlist(user, query) {
  const block = denied(user);
  if (block) return block;
  const page = parsePage(query);
  const where = { scoutId: user.id };
  if (query.status) {
    const parsed = validateShortlistPatch({ status: query.status }, { partial: true });
    if (!parsed.ok || !parsed.value.status) return { status: 400, body: { msg: 'Statusi nuk është i vlefshëm.' } };
    where.status = parsed.value.status;
  }
  if (query.priority) {
    const parsed = validateShortlistPatch({ priority: query.priority }, { partial: true });
    if (!parsed.ok || !parsed.value.priority) return { status: 400, body: { msg: 'Prioriteti nuk është i vlefshëm.' } };
    where.priority = parsed.value.priority;
  }
  const { rows, count } = await ScoutShortlist.findAndCountAll({
    where,
    include: [{ model: User, as: 'player', attributes: USER_FIELDS, include: [{ model: Profile, attributes: PROFILE_FIELDS }] }],
    order: [['updatedAt', 'DESC']],
    limit: page.limit,
    offset: page.offset,
  });
  const players = rows.map((row) => row.player).filter(Boolean);
  const profile = await Profile.findOne({ where: { userId: user.id }, attributes: ['position'] });
  const prefs = preferenceView(await preferenceRow(user.id), profile);
  const enriched = await enrich(user.id, players, prefs);
  const byId = new Map(enriched.map((item) => [item.user.id, item.card]));
  return {
    status: 200,
    body: {
      page: page.page,
      limit: page.limit,
      total: count,
      items: rows.map((row) => ({
        id: row.id,
        playerId: row.playerId,
        note: row.note,
        priority: row.priority,
        status: row.status,
        followUpDate: row.followUpDate,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        player: byId.get(row.playerId) || null,
      })),
    },
  };
}

async function addShortlist(user, body = {}) {
  const block = denied(user);
  if (block) return block;
  const athlete = await requireAthlete(body.playerId);
  if (!athlete) return { status: 404, body: { msg: 'Lojtari nuk u gjet.' } };
  const parsed = validateShortlistPatch(body);
  if (!parsed.ok) return { status: 400, body: { msg: parsed.msg } };
  try {
    const row = await ScoutShortlist.create({ scoutId: user.id, playerId: athlete.id, ...parsed.value });
    return { status: 201, body: row };
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      return { status: 409, body: { msg: 'Lojtari është tashmë në shortlist.' } };
    }
    throw err;
  }
}

async function updateShortlist(user, id, body) {
  const block = denied(user);
  if (block) return block;
  const row = await ScoutShortlist.findByPk(id);
  if (!row || !ownsRecord(row.scoutId, user.id)) return { status: 404, body: { msg: 'Shortlista nuk u gjet.' } };
  const parsed = validateShortlistPatch(body, { partial: true });
  if (!parsed.ok) return { status: 400, body: { msg: parsed.msg } };
  await row.update(parsed.value);
  return { status: 200, body: row };
}

async function removeShortlist(user, id) {
  const block = denied(user);
  if (block) return block;
  const row = await ScoutShortlist.findByPk(id);
  if (!row || !ownsRecord(row.scoutId, user.id)) return { status: 404, body: { msg: 'Shortlista nuk u gjet.' } };
  await row.destroy();
  return { status: 200, body: { ok: true } };
}

async function notifyScout(scoutId, player, event) {
  try {
    await Notification.create({
      userId: scoutId,
      actorId: player?.id || null,
      type: 'system',
      title: 'Watchlist',
      message: `${playerName(player)}: ${event.summary}`,
      link: '/scouting/watchlist',
      entityType: 'scouting',
      entityId: player?.id || null,
      metadata: { changeType: event.type, ...(event.payload || {}) },
    });
  } catch (err) {
    console.warn('scouting notification:', err?.message || err);
  }
}

async function refreshWatchRows(rows) {
  const players = rows.map((row) => row.player).filter(Boolean);
  const ids = players.map((player) => player.id);
  const [bundle, videos] = await Promise.all([loadBundle(ids), videoCounts(ids)]);
  const events = [];
  for (const row of rows) {
    const player = row.player;
    if (!player) continue;
    const report = buildPerformanceReport({ userId: player.id, position: player.Profile?.position, ...bundle });
    const next = snapshotFrom(player.Profile, report, videos[player.id] || 0);
    const changes = diffWatchSnapshot(row.snapshot, next);
    for (const change of changes) {
      const created = await ScoutWatchEvent.create({
        watchlistId: row.id,
        scoutId: row.scoutId,
        playerId: row.playerId,
        type: change.type,
        summary: change.summary,
        payload: change.payload || null,
      });
      events.push(created);
      await notifyScout(row.scoutId, player, change);
    }
    await row.update({ snapshot: next, lastViewedAt: new Date() });
  }
  return events;
}

async function listWatchlist(user, query) {
  const block = denied(user);
  if (block) return block;
  const page = parsePage(query);
  const { rows, count } = await ScoutWatchlist.findAndCountAll({
    where: { scoutId: user.id },
    include: [{ model: User, as: 'player', attributes: USER_FIELDS, include: [{ model: Profile, attributes: PROFILE_FIELDS }] }],
    order: [['updatedAt', 'DESC']],
    limit: page.limit,
    offset: page.offset,
  });
  await refreshWatchRows(rows);
  const profile = await Profile.findOne({ where: { userId: user.id }, attributes: ['position'] });
  const prefs = preferenceView(await preferenceRow(user.id), profile);
  const enriched = await enrich(user.id, rows.map((row) => row.player).filter(Boolean), prefs);
  const byId = new Map(enriched.map((item) => [item.user.id, item.card]));
  const recentEvents = await ScoutWatchEvent.findAll({
    where: { scoutId: user.id },
    order: [['createdAt', 'DESC']],
    limit: 20,
  });
  return {
    status: 200,
    body: {
      page: page.page,
      limit: page.limit,
      total: count,
      items: rows.map((row) => ({
        id: row.id,
        playerId: row.playerId,
        createdAt: row.createdAt,
        lastViewedAt: row.lastViewedAt,
        player: byId.get(row.playerId) || null,
      })),
      changes: recentEvents,
    },
  };
}

async function addWatchlist(user, body = {}) {
  const block = denied(user);
  if (block) return block;
  const athlete = await requireAthlete(body.playerId);
  if (!athlete) return { status: 404, body: { msg: 'Lojtari nuk u gjet.' } };
  const bundle = await loadBundle([athlete.id]);
  const report = buildPerformanceReport({ userId: athlete.id, position: athlete.Profile?.position, ...bundle });
  const videos = await videoCounts([athlete.id]);
  try {
    const row = await ScoutWatchlist.create({
      scoutId: user.id,
      playerId: athlete.id,
      lastViewedAt: new Date(),
      snapshot: snapshotFrom(athlete.Profile, report, videos[athlete.id] || 0),
    });
    return { status: 201, body: { id: row.id, playerId: row.playerId, createdAt: row.createdAt } };
  } catch (err) {
    if (err instanceof UniqueConstraintError) return { status: 409, body: { msg: 'Lojtari është tashmë në watchlist.' } };
    throw err;
  }
}

async function removeWatchlist(user, id) {
  const block = denied(user);
  if (block) return block;
  const row = await ScoutWatchlist.findByPk(id);
  if (!row || !ownsRecord(row.scoutId, user.id)) return { status: 404, body: { msg: 'Watchlista nuk u gjet.' } };
  await ScoutWatchEvent.destroy({ where: { watchlistId: row.id, scoutId: user.id } });
  await row.destroy();
  return { status: 200, body: { ok: true } };
}

function optionalFk(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return Number.NaN;
  return n;
}

async function resolveMatchContext(body) {
  const matchId = optionalFk(body.matchId);
  const tournamentRaw = body.tournamentId == null || body.tournamentId === '' ? body.competitionId : body.tournamentId;
  const tournamentId = optionalFk(tournamentRaw);
  if (Number.isNaN(matchId)) return { ok: false, status: 400, msg: 'Ndeshja nuk është e vlefshme.' };
  if (Number.isNaN(tournamentId)) return { ok: false, status: 400, msg: 'Kompeticioni nuk është i vlefshëm.' };
  if (matchId) {
    const match = await Match.findByPk(matchId, { attributes: ['id', 'tournamentId'] });
    if (!match) return { ok: false, status: 400, msg: 'Ndeshja nuk u gjet.' };
    if (tournamentId && Number(match.tournamentId) !== tournamentId) {
      return { ok: false, status: 400, msg: 'Ndeshja nuk i përket kompeticionit të zgjedhur.' };
    }
    return { ok: true, matchId, tournamentId: tournamentId || match.tournamentId };
  }
  if (tournamentId) {
    const tournament = await Tournament.findByPk(tournamentId, { attributes: ['id'] });
    if (!tournament) return { ok: false, status: 400, msg: 'Kompeticioni nuk u gjet.' };
  }
  return { ok: true, matchId: null, tournamentId: tournamentId || null, playerId };
}

async function listReports(user, query) {
  const block = denied(user);
  if (block) return block;
  const page = parsePage(query);
  const where = { scoutId: user.id };
  if (query.playerId) where.playerId = Number(query.playerId);
  if (query.status) {
    const status = String(query.status).toLowerCase();
    if (!['draft', 'completed'].includes(status)) return { status: 400, body: { msg: 'Statusi i raportit nuk është i vlefshëm.' } };
    where.status = status;
  }
  const { rows, count } = await ScoutingReport.findAndCountAll({
    where,
    include: [{ model: User, as: 'player', attributes: ['id', 'firstName', 'lastName'], include: [{ model: Profile, attributes: ['profilePhoto', 'position', 'club'] }] }],
    order: [['updatedAt', 'DESC']],
    limit: page.limit,
    offset: page.offset,
  });
  return {
    status: 200,
    body: { page: page.page, limit: page.limit, total: count, reports: rows.map(presentReport) },
  };
}

async function createReport(user, body = {}) {
  const block = denied(user);
  if (block) return block;
  const athlete = await requireAthlete(body.playerId);
  if (!athlete) return { status: 404, body: { msg: 'Lojtari nuk u gjet.' } };
  const parsed = validateReportPayload(body, athlete.Profile?.position);
  if (!parsed.ok) return { status: 400, body: { msg: parsed.msg, field: parsed.field } };
  const context = await resolveMatchContext(body);
  if (!context.ok) return { status: context.status, body: { msg: context.msg } };
  const existing = await ScoutingReport.findAll({
    where: { scoutId: user.id, playerId: athlete.id },
    order: [['createdAt', 'DESC']],
    limit: 10,
  });
  if (existing.some((row) => isDuplicateReport(row, { matchId: context.matchId }))) {
    return { status: 409, body: { msg: 'Ekziston tashmë një raport për këtë lojtar në të njëjtën ndeshje ose për sot.' } };
  }
  try {
    const row = await ScoutingReport.create({
      scoutId: user.id,
      playerId: athlete.id,
      tournamentId: context.tournamentId,
      matchId: context.matchId,
      ...parsed.value,
    });
    return { status: 201, body: presentReport(row) };
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      return { status: 409, body: { msg: 'Ekziston tashmë një raport për këtë lojtar dhe ndeshje.' } };
    }
    throw err;
  }
}

async function updateReport(user, id, body = {}) {
  const block = denied(user);
  if (block) return block;
  const row = await ScoutingReport.findByPk(id);
  if (!row || !ownsRecord(row.scoutId, user.id)) return { status: 404, body: { msg: 'Raporti nuk u gjet.' } };
  const athlete = await requireAthlete(row.playerId);
  const parsed = validateReportPayload({ ...row.get({ plain: true }), ...body, playerId: row.playerId }, athlete?.Profile?.position);
  if (!parsed.ok) return { status: 400, body: { msg: parsed.msg, field: parsed.field } };
  const context = await resolveMatchContext({ ...body, matchId: body.matchId === undefined ? row.matchId : body.matchId, tournamentId: body.tournamentId === undefined ? row.tournamentId : body.tournamentId });
  if (!context.ok) return { status: context.status, body: { msg: context.msg } };
  if (context.matchId && Number(context.matchId) !== Number(row.matchId || 0)) {
    const clash = await ScoutingReport.findOne({ where: { scoutId: user.id, playerId: row.playerId, matchId: context.matchId } });
    if (clash && clash.id !== row.id) return { status: 409, body: { msg: 'Ekziston tashmë një raport për këtë ndeshje.' } };
  }
  await row.update({ ...parsed.value, matchId: context.matchId, tournamentId: context.tournamentId });
  return { status: 200, body: presentReport(row) };
}

async function removeReport(user, id) {
  const block = denied(user);
  if (block) return block;
  const row = await ScoutingReport.findByPk(id);
  if (!row || !ownsRecord(row.scoutId, user.id)) return { status: 404, body: { msg: 'Raporti nuk u gjet.' } };
  await row.destroy();
  return { status: 200, body: { ok: true } };
}

async function comparePlayers(user, query) {
  const parsed = parseIdList(query.ids);
  if (!parsed.ok) return { status: 400, body: { msg: 'Zgjidh nga 2 deri në 4 lojtarë.' } };
  const period = comparisonPeriod({ window: query.window, season: query.season });
  const athletes = await athletesByIds(parsed.ids);
  if (athletes.length !== parsed.ids.length) return { status: 404, body: { msg: 'Një ose më shumë lojtarë nuk u gjetën.' } };
  const bundle = await loadBundle(parsed.ids);
  const players = athletes.map((athlete) => {
    const report = buildPerformanceReport({ userId: athlete.id, position: athlete.Profile?.position, ...bundle });
    const physical = readPhysical(athlete.Profile?.stats);
    const stats = statsForPeriod(report, period);
    const seasonStats = period.window === 'season' ? null : statsForPeriod(report, comparisonPeriod({ season: period.season }));
    return {
      playerId: athlete.id,
      playerName: playerName(athlete),
      age: athlete.Profile?.age ?? null,
      position: athlete.Profile?.position || null,
      club: athlete.Profile?.club || null,
      profilePhoto: athlete.Profile?.profilePhoto || null,
      height: physical.height,
      preferredFoot: physical.preferredFoot,
      verified: effectiveVerified(athlete),
      period,
      stats,
      trend: trendFor(report, period.window === 'career' ? 'last10' : period.window),
      seasonNote: seasonStats ? 'Season totals are separate from the selected comparison window.' : null,
    };
  });
  return {
    status: 200,
    body: {
      period,
      players,
      metrics: ['age', 'position', 'height', 'preferredFoot', 'appearances', 'minutes', 'goals', 'assists', 'yellowCards', 'redCards', 'rating'],
    },
  };
}

async function dashboard(user) {
  const block = denied(user);
  if (block) return block;
  const recommended = await recommendations(user, { limit: 6 });
  const sincePlayers = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sinceMatches = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
  const newUsers = await User.findAll({
    where: { role: 'athlete', deletedAt: null, bannedAt: null, createdAt: { [Op.gte]: sincePlayers } },
    attributes: USER_FIELDS,
    include: [{ model: Profile, required: true, attributes: PROFILE_FIELDS }],
    order: [['createdAt', 'DESC']],
    limit: 8,
  });
  const profile = await Profile.findOne({ where: { userId: user.id }, attributes: ['position'] });
  const prefs = preferenceView(await preferenceRow(user.id), profile);
  const fresh = await enrich(user.id, newUsers, prefs);

  let trending = [];
  try {
    const rows = await sequelize.query(
      `
        SELECT pms."userId" AS "userId"
        FROM "PlayerMatchStats" pms
        JOIN "Matches" m ON m.id = pms."matchId"
        WHERE m."matchDate" >= :since
        GROUP BY pms."userId"
        HAVING COUNT(pms.id) >= 1
        ORDER BY (SUM(pms.goals) + SUM(pms.assists)) DESC, AVG(pms.rating) DESC NULLS LAST
        LIMIT 8
      `,
      { replacements: { since: sinceMatches }, type: QueryTypes.SELECT }
    );
    const ids = rows.map((row) => Number(row.userId)).filter((id) => id > 0);
    trending = (await enrich(user.id, await athletesByIds(ids), prefs)).map((item) => item.card);
  } catch (err) {
    console.warn('scouting trending:', err?.message || err);
  }

  const today = new Date().toISOString().slice(0, 10);
  const [active, highPriority, followUps, drafts, completed, changes, recentReports, recentShortlist] = await Promise.all([
    ScoutShortlist.count({ where: { scoutId: user.id, status: { [Op.in]: [...ACTIVE_SHORTLIST] } } }),
    ScoutShortlist.count({ where: { scoutId: user.id, priority: { [Op.in]: ['HIGH', 'URGENT'] }, status: { [Op.notIn]: ['SIGNED', 'REJECTED'] } } }),
    ScoutShortlist.findAll({
      where: { scoutId: user.id, followUpDate: { [Op.ne]: null, [Op.lte]: today }, status: { [Op.in]: [...ACTIVE_SHORTLIST] } },
      include: [{ model: User, as: 'player', attributes: ['id', 'firstName', 'lastName'] }],
      order: [['followUpDate', 'ASC']],
      limit: 8,
    }),
    ScoutingReport.count({ where: { scoutId: user.id, status: 'draft' } }),
    ScoutingReport.count({ where: { scoutId: user.id, status: 'completed' } }),
    ScoutWatchEvent.findAll({ where: { scoutId: user.id }, order: [['createdAt', 'DESC']], limit: 8 }),
    ScoutingReport.findAll({
      where: { scoutId: user.id },
      include: [{ model: User, as: 'player', attributes: ['id', 'firstName', 'lastName'] }],
      order: [['updatedAt', 'DESC']],
      limit: 5,
    }),
    ScoutShortlist.findAll({
      where: { scoutId: user.id },
      include: [{ model: User, as: 'player', attributes: ['id', 'firstName', 'lastName'] }],
      order: [['updatedAt', 'DESC']],
      limit: 5,
    }),
  ]);

  return {
    status: 200,
    body: {
      discovery: {
        recommended: recommended.status === 200 ? recommended.body.recommendations : [],
        newPlayers: fresh.map((item) => item.card),
        trending,
      },
      shortlist: {
        active,
        highPriority,
        followUps: followUps.map((row) => ({
          id: row.id,
          playerId: row.playerId,
          playerName: playerName(row.player),
          status: row.status,
          priority: row.priority,
          followUpDate: row.followUpDate,
        })),
      },
      watchlist: { recentChanges: changes },
      reports: { drafts, completed },
      activity: [
        ...recentReports.map((row) => ({
          type: 'report',
          at: row.updatedAt,
          label: `${row.status === 'draft' ? 'Draft' : 'Report'} · ${playerName(row.player)}`,
          playerId: row.playerId,
        })),
        ...recentShortlist.map((row) => ({
          type: 'shortlist',
          at: row.updatedAt,
          label: `${row.status} · ${playerName(row.player)}`,
          playerId: row.playerId,
        })),
      ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 8),
    },
  };
}

module.exports = {
  addShortlist,
  addWatchlist,
  comparePlayers,
  createReport,
  dashboard,
  denied,
  discover,
  getPreferences,
  listReports,
  listShortlist,
  listWatchlist,
  meta,
  playerCard,
  recommendations,
  removeReport,
  removeShortlist,
  removeWatchlist,
  savePreferences,
  updateReport,
  updateShortlist,
};
