const User = require('../models/User');
const Profile = require('../models/Profile');
const {
  generateProfileBio,
  generateScoutSummary,
  suggestPostCaption,
  isAiConfigured,
} = require('../services/aiService');
const { getDailyLimit } = require('../config/ai');

const SCOUT_ROLES = new Set(['scout', 'coach', 'club', 'manager', 'trajner']);

const usageByUser = new Map();

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function checkAndBumpUsage(userId) {
  const key = `${userId}:${todayKey()}`;
  const limit = getDailyLimit();
  const entry = usageByUser.get(key) || { count: 0 };
  if (entry.count >= limit) {
    return { ok: false, remaining: 0, limit };
  }
  entry.count += 1;
  usageByUser.set(key, entry);
  return { ok: true, remaining: limit - entry.count, limit };
}

exports.status = (_req, res) => {
  res.json({
    configured: isAiConfigured(),
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    dailyLimitPerUser: getDailyLimit(),
  });
};

exports.generateBio = async (req, res) => {
  try {
    if (!isAiConfigured()) {
      return res.status(503).json({
        error: 'AI nuk është konfiguruar. Vendos OPENAI_API_KEY në server.',
        code: 'AI_NOT_CONFIGURED',
      });
    }

    const usage = checkAndBumpUsage(req.user.id);
    if (!usage.ok) {
      return res.status(429).json({
        error: `Limiti ditor i AI (${usage.limit}) u arrit. Provo nesër.`,
        code: 'AI_RATE_LIMIT',
      });
    }

    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'firstName', 'lastName', 'role', 'dateOfBirth'],
    });
    const profile = await Profile.findOne({ where: { userId: req.user.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const hints = {
      extra: req.body?.hints || req.body?.extra || '',
      language: req.body?.language || 'sq',
      position: req.body?.position,
      club: req.body?.club,
      city: req.body?.city,
      country: req.body?.country,
      role: req.body?.role,
    };

    const bio = await generateProfileBio(user, profile, hints);
    res.json({ bio, remaining: usage.remaining });
  } catch (err) {
    console.error('AI generateBio:', err.message);
    const code = err.code || 'AI_ERROR';
    const status = code === 'AI_NOT_CONFIGURED' ? 503 : 502;
    res.status(status).json({ error: err.message, code });
  }
};

exports.scoutSummary = async (req, res) => {
  try {
    if (!SCOUT_ROLES.has(String(req.user.role || '').toLowerCase())) {
      return res.status(403).json({ error: 'Vetëm skautë/trajnerë/klube mund të përdorin këtë funksion.' });
    }
    if (!isAiConfigured()) {
      return res.status(503).json({ error: 'AI nuk është konfiguruar.', code: 'AI_NOT_CONFIGURED' });
    }

    const usage = checkAndBumpUsage(req.user.id);
    if (!usage.ok) {
      return res.status(429).json({ error: 'Limiti ditor i AI u arrit.', code: 'AI_RATE_LIMIT' });
    }

    const targetUserId = parseInt(req.params.userId, 10);
    if (!Number.isFinite(targetUserId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const targetUser = await User.findByPk(targetUserId, {
      attributes: ['id', 'firstName', 'lastName', 'role'],
    });
    if (!targetUser || targetUser.role !== 'athlete') {
      return res.status(404).json({ error: 'Athlete not found' });
    }

    const targetProfile = await Profile.findOne({ where: { userId: targetUserId } });
    const summary = await generateScoutSummary(targetUser, targetProfile, req.user);

    res.json({
      summary,
      playerId: targetUserId,
      playerName: `${targetUser.firstName} ${targetUser.lastName}`.trim(),
      remaining: usage.remaining,
    });
  } catch (err) {
    console.error('AI scoutSummary:', err.message);
    res.status(502).json({ error: err.message, code: err.code || 'AI_ERROR' });
  }
};

exports.suggestPost = async (req, res) => {
  try {
    if (!isAiConfigured()) {
      return res.status(503).json({ error: 'AI nuk është konfiguruar.', code: 'AI_NOT_CONFIGURED' });
    }
    const usage = checkAndBumpUsage(req.user.id);
    if (!usage.ok) {
      return res.status(429).json({ error: 'Limiti ditor i AI u arrit.', code: 'AI_RATE_LIMIT' });
    }
    const caption = await suggestPostCaption(req.body || {});
    res.json({ caption, remaining: usage.remaining });
  } catch (err) {
    console.error('AI suggestPost:', err.message);
    res.status(502).json({ error: err.message });
  }
};
