const { Op } = require('sequelize');
const Report = require('../models/Report');
const Block = require('../models/Block');
const User = require('../models/User');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Message = require('../models/Message');
const Stream = require('../models/Stream');

const ALLOWED_TYPES = new Set(['post', 'comment', 'profile', 'message', 'live', 'user']);
const ALLOWED_REASONS = new Set([
  'spam',
  'harassment',
  'hate',
  'violence',
  'sexual',
  'impersonation',
  'scam',
  'other',
]);

async function assertTargetExists(targetType, targetId) {
  if (targetType === 'post') return !!(await Post.findByPk(targetId));
  if (targetType === 'comment') return !!(await Comment.findByPk(targetId));
  if (targetType === 'message') return !!(await Message.findByPk(targetId));
  if (targetType === 'live') return !!(await Stream.findByPk(targetId));
  if (targetType === 'profile' || targetType === 'user') return !!(await User.findByPk(targetId));
  return false;
}

exports.createReport = async (req, res) => {
  try {
    const targetType = String(req.body?.targetType || '').toLowerCase();
    const targetId = parseInt(req.body?.targetId, 10);
    const reason = String(req.body?.reason || '').toLowerCase();
    const details = req.body?.details ? String(req.body.details).slice(0, 2000) : null;

    if (!ALLOWED_TYPES.has(targetType)) {
      return res.status(400).json({ msg: 'Lloji i raportimit nuk është i vlefshëm' });
    }
    if (!Number.isFinite(targetId) || targetId <= 0) {
      return res.status(400).json({ msg: 'targetId i pavlefshëm' });
    }
    if (!ALLOWED_REASONS.has(reason)) {
      return res.status(400).json({ msg: 'Arsyeja e raportimit nuk është e vlefshme' });
    }

    const exists = await assertTargetExists(targetType, targetId);
    if (!exists) return res.status(404).json({ msg: 'Objekti i raportuar nuk u gjet' });

    if ((targetType === 'profile' || targetType === 'user') && targetId === req.user.id) {
      return res.status(400).json({ msg: 'Nuk mund të raportosh veten' });
    }

    const recent = await Report.findOne({
      where: {
        reporterId: req.user.id,
        targetType,
        targetId,
        createdAt: { [Op.gt]: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    if (recent) {
      return res.status(409).json({ msg: 'E ke raportuar tashmë gjatë 24 orëve të fundit' });
    }

    const report = await Report.create({
      reporterId: req.user.id,
      targetType,
      targetId,
      reason,
      details,
      status: 'pending',
    });

    res.status(201).json({ msg: 'Raportimi u dërgua', report });
  } catch (err) {
    console.error('createReport error:', err);
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

exports.blockUser = async (req, res) => {
  try {
    const blockedId = parseInt(req.params.userId, 10);
    if (!Number.isFinite(blockedId) || blockedId <= 0) {
      return res.status(400).json({ msg: 'userId i pavlefshëm' });
    }
    if (blockedId === req.user.id) {
      return res.status(400).json({ msg: 'Nuk mund të bllokosh veten' });
    }
    const target = await User.findByPk(blockedId);
    if (!target || target.deletedAt) {
      return res.status(404).json({ msg: 'Përdoruesi nuk u gjet' });
    }

    const [row] = await Block.findOrCreate({
      where: { blockerId: req.user.id, blockedId },
      defaults: { blockerId: req.user.id, blockedId },
    });
    res.json({ msg: 'Përdoruesi u bllokua', block: row });
  } catch (err) {
    console.error('blockUser error:', err);
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

exports.unblockUser = async (req, res) => {
  try {
    const blockedId = parseInt(req.params.userId, 10);
    const deleted = await Block.destroy({
      where: { blockerId: req.user.id, blockedId },
    });
    if (!deleted) return res.status(404).json({ msg: 'Bllokimi nuk u gjet' });
    res.json({ msg: 'Bllokimi u hoq' });
  } catch (err) {
    console.error('unblockUser error:', err);
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

exports.listMyBlocks = async (req, res) => {
  try {
    const blocks = await Block.findAll({
      where: { blockerId: req.user.id },
      include: [{ model: User, as: 'blockedUser', attributes: ['id', 'firstName', 'lastName'] }],
      order: [['createdAt', 'DESC']],
    });
    res.json({ blocks });
  } catch (err) {
    console.error('listMyBlocks error:', err);
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

exports.getBlockStatus = async (req, res) => {
  try {
    const otherId = parseInt(req.params.userId, 10);
    const iBlocked = !!(await Block.findOne({
      where: { blockerId: req.user.id, blockedId: otherId },
    }));
    const blockedMe = !!(await Block.findOne({
      where: { blockerId: otherId, blockedId: req.user.id },
    }));
    res.json({ iBlocked, blockedMe, either: iBlocked || blockedMe });
  } catch (err) {
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

exports.listReportsAdmin = async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 30 } = req.query;
    const where = {};
    if (status && status !== 'all') where.status = status;
    const rows = await Report.findAndCountAll({
      where,
      include: [{ model: User, as: 'reporter', attributes: ['id', 'firstName', 'lastName', 'email'] }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit, 10),
      offset: (parseInt(page, 10) - 1) * parseInt(limit, 10),
    });
    res.json({
      reports: rows.rows,
      total: rows.count,
      page: parseInt(page, 10),
      pages: Math.ceil(rows.count / parseInt(limit, 10)),
    });
  } catch (err) {
    console.error('listReportsAdmin error:', err);
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

exports.reviewReportAdmin = async (req, res) => {
  try {
    const report = await Report.findByPk(req.params.reportId);
    if (!report) return res.status(404).json({ msg: 'Raporti nuk u gjet' });
    const status = String(req.body?.status || '').toLowerCase();
    if (!['reviewed', 'actioned', 'dismissed'].includes(status)) {
      return res.status(400).json({ msg: 'Status i pavlefshëm' });
    }
    report.status = status;
    report.reviewedBy = req.user.id;
    report.reviewedAt = new Date();
    await report.save();
    res.json({ msg: 'Raporti u përditësua', report });
  } catch (err) {
    console.error('reviewReportAdmin error:', err);
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

/** Shared helper: true if either user blocked the other. */
exports.isEitherBlocked = async (a, b) => {
  const row = await Block.findOne({
    where: {
      [Op.or]: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
  });
  return !!row;
};
