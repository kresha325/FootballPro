const { Op } = require('sequelize');
const {
  MediaItem,
  MediaEvent,
  User,
  Match,
  Tournament,
} = require('../models');
const ClubMember = require('../models/ClubMember');
const { parseYouTubeUrl, youtubeThumbnailUrl } = require('../utils/youtubeVideo');
const { canManageTournamentMatches } = require('../utils/matchPermissions');

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

function toInt(v) {
  if (v == null || v === '') return null;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

function normalizeCategory(raw) {
  const c = String(raw || 'other').trim().toLowerCase();
  return MediaItem.CATEGORIES.includes(c) ? c : null;
}

function normalizeVisibility(raw) {
  const v = String(raw || 'public').trim().toLowerCase();
  return MediaItem.VISIBILITIES.includes(v) ? v : null;
}

function visibilityWhere(viewer, opts = {}) {
  const { includeUnlistedInContext = false } = opts;
  if (viewer?.role === 'admin') return {};

  const clauses = [{ visibility: 'public' }];
  if (includeUnlistedInContext) {
    clauses.push({ visibility: 'unlisted' });
  }
  if (viewer?.id) {
    clauses.push({ uploadedBy: viewer.id });
    clauses.push({ playerId: viewer.id });
    clauses.push({ clubId: viewer.id });
  }
  return { [Op.or]: clauses };
}

async function isClubRosterAthlete(clubId, athleteId) {
  if (!clubId || !athleteId) return false;
  const row = await ClubMember.findOne({
    where: {
      clubId,
      athleteId,
      status: 'approved',
    },
  });
  return !!row;
}

async function canAttachPlayer(user, playerId) {
  if (!playerId) return { ok: true };
  if (user.role === 'admin') return { ok: true };
  if (Number(playerId) === Number(user.id)) return { ok: true };
  if (user.role === 'club') {
    const ok = await isClubRosterAthlete(user.id, playerId);
    if (ok) return { ok: true };
    return { ok: false, status: 403, msg: 'Lojtari nuk është në rosterin e klubit tuaj.' };
  }
  return { ok: false, status: 403, msg: 'Mund të lidhni vetëm median tuaj.' };
}

async function canAttachClub(user, clubId) {
  if (!clubId) return { ok: true };
  if (user.role === 'admin') return { ok: true };
  if (Number(clubId) === Number(user.id) && (user.role === 'club' || user.role === 'admin')) {
    return { ok: true };
  }
  return { ok: false, status: 403, msg: 'Vetëm administratori i klubit mund të lidhë median me këtë klub.' };
}

async function canAttachMatch(user, matchId) {
  if (!matchId) return { ok: true };
  if (user.role === 'admin') return { ok: true };

  const match = await Match.findByPk(matchId, {
    include: [{ model: Tournament, required: false }],
  });
  if (!match) return { ok: false, status: 404, msg: 'Ndeshja nuk u gjet.' };

  const tournament = match.Tournament || (match.tournamentId
    ? await Tournament.findByPk(match.tournamentId)
    : null);

  if (tournament) {
    const manage = canManageTournamentMatches(tournament, user);
    if (manage.ok) return { ok: true };
  }

  if (
    Number(match.homeUserId) === Number(user.id) ||
    Number(match.awayUserId) === Number(user.id)
  ) {
    return { ok: true };
  }

  return { ok: false, status: 403, msg: 'Nuk jeni të autorizuar për median e kësaj ndeshjeje.' };
}

async function canManageMediaItem(user, item) {
  if (!user?.id || !item) return false;
  if (user.role === 'admin') return true;
  if (Number(item.uploadedBy) === Number(user.id)) return true;
  if (item.clubId && Number(item.clubId) === Number(user.id)) return true;
  if (item.playerId && Number(item.playerId) === Number(user.id)) return true;
  return false;
}

function canViewMediaItem(viewer, item) {
  if (!item) return false;
  if (item.visibility === 'public') return true;
  if (item.visibility === 'unlisted') return true; // direct / parent context
  if (!viewer?.id) return false;
  if (viewer.role === 'admin') return true;
  if (Number(item.uploadedBy) === Number(viewer.id)) return true;
  if (item.playerId && Number(item.playerId) === Number(viewer.id)) return true;
  if (item.clubId && Number(item.clubId) === Number(viewer.id)) return true;
  return false;
}

const listInclude = [
  { model: User, as: 'uploader', attributes: ['id', 'firstName', 'lastName', 'role'] },
  { model: User, as: 'player', attributes: ['id', 'firstName', 'lastName', 'role'] },
  { model: User, as: 'club', attributes: ['id', 'firstName', 'lastName', 'role'] },
];

function parsePagination(query) {
  const page = Math.max(1, parseInt(String(query.page || '1'), 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(String(query.limit || String(DEFAULT_LIMIT)), 10) || DEFAULT_LIMIT));
  return { page, limit, offset: (page - 1) * limit };
}

function buildListFilters(query, viewer, { contextUnlisted = false, forSearch = false } = {}) {
  const where = {
    ...visibilityWhere(viewer, { includeUnlistedInContext: contextUnlisted }),
  };

  if (forSearch) {
    // Global search: never include unlisted/private unless owner/admin via visibilityWhere
    Object.assign(where, visibilityWhere(viewer, { includeUnlistedInContext: false }));
    // Force public-only for anonymous global browse
    if (!viewer?.id) {
      where.visibility = 'public';
      delete where[Op.or];
    } else if (viewer.role !== 'admin') {
      where[Op.and] = [
        {
          [Op.or]: [
            { visibility: 'public' },
            { uploadedBy: viewer.id },
            { playerId: viewer.id },
            { clubId: viewer.id },
          ],
        },
      ];
      delete where[Op.or];
    }
  }

  const playerId = toInt(query.playerId);
  const clubId = toInt(query.clubId);
  const matchId = toInt(query.matchId);
  const teamId = toInt(query.teamId);
  const tournamentId = toInt(query.tournamentId);
  const category = query.category ? normalizeCategory(query.category) : null;
  const visibility = query.visibility ? normalizeVisibility(query.visibility) : null;
  const season = query.season ? String(query.season).trim() : null;
  const q = query.q ? String(query.q).trim() : null;

  if (playerId) where.playerId = playerId;
  if (clubId) where.clubId = clubId;
  if (matchId) where.matchId = matchId;
  if (teamId) where.teamId = teamId;
  if (tournamentId) where.tournamentId = tournamentId;
  if (category) where.category = category;
  if (visibility && viewer?.role === 'admin') where.visibility = visibility;
  if (season) where.season = season;
  if (q) {
    where[Op.and] = [
      ...(where[Op.and] || []),
      {
        [Op.or]: [
          { title: { [Op.iLike]: `%${q}%` } },
          { description: { [Op.iLike]: `%${q}%` } },
          { youtubeVideoId: { [Op.iLike]: `%${q}%` } },
        ],
      },
    ];
  }

  return where;
}

exports.createMedia = async (req, res) => {
  try {
    const {
      youtubeUrl,
      title,
      description,
      category,
      visibility,
      playerId,
      clubId,
      matchId,
      teamId,
      tournamentId,
      season,
      durationSeconds,
      publishedAt,
    } = req.body || {};

    const parsed = parseYouTubeUrl(youtubeUrl);
    if (!parsed.ok) {
      return res.status(400).json({ msg: parsed.error });
    }

    const cat = normalizeCategory(category || 'other');
    if (!cat) return res.status(400).json({ msg: 'Kategori e pavlefshme' });

    const { hasTier, HIGHLIGHT_LIMIT_BASIC, getEffectiveTier } = require('../utils/subscriptionAccess');
    const highlightCats = new Set(['match_highlight', 'goal', 'skills']);
    if (highlightCats.has(cat)) {
      if (!hasTier(req.user, 'basic')) {
        return res.status(403).json({
          msg: 'Highlights kërkojnë planin Basic/Pro ose trial 30-ditor.',
          code: 'PLAN_REQUIRED',
          requiredTier: 'basic',
        });
      }
      const tier = getEffectiveTier(req.user);
      if (tier !== 'pro') {
        const count = await MediaItem.count({
          where: {
            uploadedBy: req.user.id,
            category: { [Op.in]: [...highlightCats] },
          },
        });
        if (count >= HIGHLIGHT_LIMIT_BASIC) {
          return res.status(403).json({
            msg: `Plani Basic lejon deri në ${HIGHLIGHT_LIMIT_BASIC} highlights. Upgrade në Pro për pa limit.`,
            code: 'HIGHLIGHT_LIMIT',
            limit: HIGHLIGHT_LIMIT_BASIC,
          });
        }
      }
    }

    const vis = normalizeVisibility(visibility || 'public');
    if (!vis) return res.status(400).json({ msg: 'Visibility e pavlefshme' });

    const cleanTitle = String(title || '').trim();
    if (!cleanTitle) return res.status(400).json({ msg: 'Titulli është i detyrueshëm' });

    let pId = toInt(playerId);
    let cId = toInt(clubId);
    const mId = toInt(matchId);
    const tId = toInt(teamId);
    const tourId = toInt(tournamentId);

    // Context defaults
    if (!pId && req.user.role === 'athlete') pId = req.user.id;
    if (!cId && req.user.role === 'club') cId = req.user.id;

    const playerAuth = await canAttachPlayer(req.user, pId);
    if (!playerAuth.ok) return res.status(playerAuth.status).json({ msg: playerAuth.msg });

    const clubAuth = await canAttachClub(req.user, cId);
    if (!clubAuth.ok) return res.status(clubAuth.status).json({ msg: clubAuth.msg });

    const matchAuth = await canAttachMatch(req.user, mId);
    if (!matchAuth.ok) return res.status(matchAuth.status).json({ msg: matchAuth.msg });

    if (tId && req.user.role !== 'admin' && Number(tId) !== Number(req.user.id) && Number(tId) !== Number(cId)) {
      return res.status(403).json({ msg: 'Team i pavlefshëm për këtë llogari.' });
    }

    let resolvedSeason = season ? String(season).trim().slice(0, 64) : null;
    let resolvedTournamentId = tourId;
    if (mId && (!resolvedSeason || !resolvedTournamentId)) {
      const match = await Match.findByPk(mId, { include: [{ model: Tournament, required: false }] });
      if (match?.tournamentId && !resolvedTournamentId) resolvedTournamentId = match.tournamentId;
      if (!resolvedSeason && match?.Tournament?.season) resolvedSeason = match.Tournament.season;
    }

    const item = await MediaItem.create({
      youtubeVideoId: parsed.videoId,
      youtubeUrl: parsed.youtubeUrl,
      title: cleanTitle.slice(0, 255),
      description: description != null ? String(description).slice(0, 5000) : null,
      thumbnailUrl: parsed.thumbnailUrl || youtubeThumbnailUrl(parsed.videoId),
      mediaType: 'youtube',
      category: cat,
      playerId: pId,
      clubId: cId,
      matchId: mId,
      teamId: tId || cId || null,
      tournamentId: resolvedTournamentId,
      season: resolvedSeason,
      uploadedBy: req.user.id,
      visibility: vis,
      durationSeconds: toInt(durationSeconds),
      publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
      featured: req.body?.featured === true || req.body?.featured === 'true',
      sortOrder: Number.isFinite(Number(req.body?.sortOrder)) ? Number(req.body.sortOrder) : 0,
    });

    const full = await MediaItem.findByPk(item.id, { include: listInclude });
    return res.status(201).json(full);
  } catch (err) {
    if (err?.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ msg: 'Ky video YouTube është shtuar tashmë nga ju.' });
    }
    console.error('createMedia:', err);
    return res.status(500).json({ msg: 'Server error', details: err.message });
  }
};

exports.listMedia = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const where = buildListFilters(req.query, req.user, {
      forSearch: !req.query.playerId && !req.query.clubId && !req.query.matchId,
      contextUnlisted: !!(req.query.playerId || req.query.clubId || req.query.matchId),
    });

    const { rows, count } = await MediaItem.findAndCountAll({
      where,
      include: listInclude,
      order: [
        ['featured', 'DESC'],
        ['sortOrder', 'ASC'],
        ['createdAt', 'DESC'],
      ],
      limit,
      offset,
    });

    return res.json({
      items: rows,
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit) || 1,
    });
  } catch (err) {
    console.error('listMedia:', err);
    return res.status(500).json({ msg: 'Server error', details: err.message });
  }
};

async function listByRelation(req, res, field, id) {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const where = {
      [field]: id,
      ...visibilityWhere(req.user, { includeUnlistedInContext: true }),
    };
    if (req.query.category) {
      const cat = normalizeCategory(req.query.category);
      if (cat) where.category = cat;
    }

    const { rows, count } = await MediaItem.findAndCountAll({
      where,
      include: listInclude,
      order: [
        ['featured', 'DESC'],
        ['sortOrder', 'ASC'],
        ['createdAt', 'DESC'],
      ],
      limit,
      offset,
    });

    return res.json({
      items: rows,
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit) || 1,
    });
  } catch (err) {
    console.error('listByRelation:', err);
    return res.status(500).json({ msg: 'Server error', details: err.message });
  }
}

exports.listPlayerMedia = (req, res) => {
  const id = toInt(req.params.playerId);
  if (!id) return res.status(400).json({ msg: 'playerId i pavlefshëm' });
  return listByRelation(req, res, 'playerId', id);
};

exports.listClubMedia = (req, res) => {
  const id = toInt(req.params.clubId);
  if (!id) return res.status(400).json({ msg: 'clubId i pavlefshëm' });
  return listByRelation(req, res, 'clubId', id);
};

exports.listMatchMedia = (req, res) => {
  const id = toInt(req.params.matchId);
  if (!id) return res.status(400).json({ msg: 'matchId i pavlefshëm' });
  return listByRelation(req, res, 'matchId', id);
};

exports.getMedia = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ msg: 'ID e pavlefshme' });

    const item = await MediaItem.findByPk(id, { include: listInclude });
    if (!item) return res.status(404).json({ msg: 'Media nuk u gjet' });
    if (!canViewMediaItem(req.user, item)) {
      return res.status(403).json({ msg: 'Nuk keni akses në këtë media' });
    }
    return res.json(item);
  } catch (err) {
    console.error('getMedia:', err);
    return res.status(500).json({ msg: 'Server error', details: err.message });
  }
};

exports.updateMedia = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ msg: 'ID e pavlefshme' });

    const item = await MediaItem.findByPk(id);
    if (!item) return res.status(404).json({ msg: 'Media nuk u gjet' });
    if (!(await canManageMediaItem(req.user, item))) {
      return res.status(403).json({ msg: 'Nuk jeni të autorizuar të ndryshoni këtë media' });
    }

    const {
      youtubeUrl,
      title,
      description,
      category,
      visibility,
      playerId,
      clubId,
      matchId,
      teamId,
      tournamentId,
      season,
      durationSeconds,
      publishedAt,
    } = req.body || {};

    if (youtubeUrl != null) {
      const parsed = parseYouTubeUrl(youtubeUrl);
      if (!parsed.ok) return res.status(400).json({ msg: parsed.error });
      item.youtubeVideoId = parsed.videoId;
      item.youtubeUrl = parsed.youtubeUrl;
      item.thumbnailUrl = parsed.thumbnailUrl;
    }

    if (title != null) {
      const cleanTitle = String(title).trim();
      if (!cleanTitle) return res.status(400).json({ msg: 'Titulli është i detyrueshëm' });
      item.title = cleanTitle.slice(0, 255);
    }
    if (description !== undefined) {
      item.description = description != null ? String(description).slice(0, 5000) : null;
    }
    if (category != null) {
      const cat = normalizeCategory(category);
      if (!cat) return res.status(400).json({ msg: 'Kategori e pavlefshme' });
      item.category = cat;
    }
    if (visibility != null) {
      const vis = normalizeVisibility(visibility);
      if (!vis) return res.status(400).json({ msg: 'Visibility e pavlefshme' });
      item.visibility = vis;
    }

    if (playerId !== undefined) {
      const pId = toInt(playerId);
      const auth = await canAttachPlayer(req.user, pId);
      if (!auth.ok) return res.status(auth.status).json({ msg: auth.msg });
      item.playerId = pId;
    }
    if (clubId !== undefined) {
      const cId = toInt(clubId);
      const auth = await canAttachClub(req.user, cId);
      if (!auth.ok) return res.status(auth.status).json({ msg: auth.msg });
      item.clubId = cId;
    }
    if (matchId !== undefined) {
      const mId = toInt(matchId);
      const auth = await canAttachMatch(req.user, mId);
      if (!auth.ok) return res.status(auth.status).json({ msg: auth.msg });
      item.matchId = mId;
    }
    if (teamId !== undefined) item.teamId = toInt(teamId);
    if (tournamentId !== undefined) item.tournamentId = toInt(tournamentId);
    if (season !== undefined) item.season = season ? String(season).trim().slice(0, 64) : null;
    if (durationSeconds !== undefined) item.durationSeconds = toInt(durationSeconds);
    if (publishedAt !== undefined) item.publishedAt = publishedAt ? new Date(publishedAt) : null;
    if (req.body?.featured != null) item.featured = req.body.featured === true || req.body.featured === 'true';
    if (req.body?.sortOrder != null && Number.isFinite(Number(req.body.sortOrder))) {
      item.sortOrder = Number(req.body.sortOrder);
    }

    await item.save();
    const full = await MediaItem.findByPk(item.id, { include: listInclude });
    return res.json(full);
  } catch (err) {
    if (err?.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ msg: 'Ky video YouTube është shtuar tashmë nga ju.' });
    }
    console.error('updateMedia:', err);
    return res.status(500).json({ msg: 'Server error', details: err.message });
  }
};

exports.deleteMedia = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ msg: 'ID e pavlefshme' });

    const item = await MediaItem.findByPk(id);
    if (!item) return res.status(404).json({ msg: 'Media nuk u gjet' });
    if (!(await canManageMediaItem(req.user, item))) {
      return res.status(403).json({ msg: 'Nuk jeni të autorizuar të fshini këtë media' });
    }

    await item.destroy();
    return res.json({ msg: 'Media u fshi', id });
  } catch (err) {
    console.error('deleteMedia:', err);
    return res.status(500).json({ msg: 'Server error', details: err.message });
  }
};

exports.trackMediaEvent = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ msg: 'ID e pavlefshme' });

    const eventType = String(req.body?.eventType || '').trim();
    if (!MediaEvent.EVENT_TYPES.includes(eventType)) {
      return res.status(400).json({ msg: 'eventType i pavlefshëm' });
    }

    const item = await MediaItem.findByPk(id);
    if (!item) return res.status(404).json({ msg: 'Media nuk u gjet' });
    if (!canViewMediaItem(req.user, item)) {
      return res.status(403).json({ msg: 'Nuk keni akses' });
    }

    await MediaEvent.create({
      mediaId: id,
      userId: req.user?.id || null,
      eventType,
    });

    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error('trackMediaEvent:', err);
    return res.status(500).json({ msg: 'Server error', details: err.message });
  }
};

exports.adminListMedia = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const where = {};

    const playerId = toInt(req.query.playerId);
    const clubId = toInt(req.query.clubId);
    const matchId = toInt(req.query.matchId);
    const category = req.query.category ? normalizeCategory(req.query.category) : null;
    const visibility = req.query.visibility ? normalizeVisibility(req.query.visibility) : null;
    const season = req.query.season ? String(req.query.season).trim() : null;
    const q = req.query.q ? String(req.query.q).trim() : null;

    if (playerId) where.playerId = playerId;
    if (clubId) where.clubId = clubId;
    if (matchId) where.matchId = matchId;
    if (category) where.category = category;
    if (visibility) where.visibility = visibility;
    if (season) where.season = season;
    if (q) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${q}%` } },
        { description: { [Op.iLike]: `%${q}%` } },
        { youtubeVideoId: { [Op.iLike]: `%${q}%` } },
        { youtubeUrl: { [Op.iLike]: `%${q}%` } },
      ];
    }

    const { rows, count } = await MediaItem.findAndCountAll({
      where,
      include: listInclude,
      order: [
        ['featured', 'DESC'],
        ['sortOrder', 'ASC'],
        ['createdAt', 'DESC'],
      ],
      limit,
      offset,
    });

    return res.json({
      items: rows,
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit) || 1,
    });
  } catch (err) {
    console.error('adminListMedia:', err);
    return res.status(500).json({ msg: 'Server error', details: err.message });
  }
};
