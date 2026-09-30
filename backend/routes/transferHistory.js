console.log('[TransferHistory] Route file loaded');
const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { Op } = require('sequelize');
const router = express.Router();
const { protect } = require('../middleware/auth');
const TransferHistory = require('../models/TransferHistory');
const User = require('../models/User');
const Profile = require('../models/Profile');
const {
  CURRENT_CLUB_NOTE,
  resolveClubUserId,
  syncProfileCurrentClubFromTransfer,
  syncProfileCurrentClubFromLatestTransfer,
  closeCurrentClubAutoStints,
  syncCareerHistoryFromTransfers,
} = require('../utils/currentClubCareer');

// resolveClubUserId may not be exported yet — fallback
async function resolveClubId(clubUserId, clubName) {
  if (typeof resolveClubUserId === 'function') {
    return resolveClubUserId({ clubUserId, clubName });
  }
  const { Op: SeqOp } = require('sequelize');
  if (clubUserId != null && Number(clubUserId) > 0) {
    const byId = await User.findByPk(Number(clubUserId));
    if (byId && String(byId.role || '').toLowerCase() === 'club') return byId.id;
  }
  const name = String(clubName || '').trim();
  if (!name) return null;
  const clubByUser = await User.findOne({
    where: {
      role: 'club',
      [SeqOp.or]: [
        { firstName: { [SeqOp.iLike]: `%${name}%` } },
        { lastName: { [SeqOp.iLike]: `%${name}%` } },
      ],
    },
  });
  return clubByUser?.id || null;
}

function transferBodyValidators({ requireCore }) {
  const list = [
    body('fromClub').optional({ values: 'falsy' }).isString().trim(),
    body('position').optional({ values: 'falsy' }).isString().trim(),
    body('transferFee').optional({ values: 'falsy' }).isString().trim(),
    body('contractUntil').optional({ values: 'falsy' }).isString().trim(),
    body('notes').optional({ values: 'falsy' }).isString().trim(),
    body('transferDate')
      .optional({ values: 'falsy' })
      .isISO8601()
      .withMessage('transferDate must be a valid date (YYYY-MM-DD)')
      .toDate(),
    body('fromClubUserId').optional({ values: 'falsy' }).isInt({ min: 1 }).toInt(),
    body('toClubUserId').optional({ values: 'falsy' }).isInt({ min: 1 }).toInt(),
  ];

  if (requireCore) {
    list.unshift(
      body('transferType')
        .isString()
        .trim()
        .notEmpty()
        .isIn(['player_transfer', 'coach_appointment', 'staff_appointment', 'loan'])
    );
    list.push(body('toClub').isString().trim().notEmpty().withMessage('To club is required'));
    list.push(body('season').isString().trim().notEmpty().withMessage('Season is required'));
  } else {
    list.unshift(
      body('transferType')
        .optional({ values: 'falsy' })
        .isString()
        .trim()
        .isIn(['player_transfer', 'coach_appointment', 'staff_appointment', 'loan'])
    );
    list.push(body('toClub').optional({ values: 'falsy' }).isString().trim());
    list.push(body('season').optional({ values: 'falsy' }).isString().trim());
  }
  return list;
}

function normalizeTransferPayload(body) {
  const fromClub = body.fromClub != null ? String(body.fromClub).trim() : '';
  const toClub = body.toClub != null ? String(body.toClub).trim() : '';
  const season = body.season != null ? String(body.season).trim() : '';
  return {
    transferType: body.transferType,
    fromClub: fromClub || null,
    toClub,
    fromClubUserId: body.fromClubUserId ? Number(body.fromClubUserId) : null,
    toClubUserId: body.toClubUserId ? Number(body.toClubUserId) : null,
    position: body.position != null && String(body.position).trim() !== '' ? String(body.position).trim() : null,
    season,
    transferDate: body.transferDate || new Date(),
    transferFee:
      body.transferFee != null && String(body.transferFee).trim() !== ''
        ? String(body.transferFee).trim()
        : null,
    contractUntil:
      body.contractUntil != null && String(body.contractUntil).trim() !== ''
        ? String(body.contractUntil).trim()
        : null,
    notes: body.notes != null && String(body.notes).trim() !== '' ? String(body.notes).trim() : null,
  };
}

function needsFromClubConfirm(transfer) {
  return Boolean(transfer.fromClubUserId) || Boolean(String(transfer.fromClub || '').trim());
}

function isFullyConfirmed(transfer) {
  if (String(transfer.status) === 'confirmed') return true;
  const fromOk = !needsFromClubConfirm(transfer) || Boolean(transfer.fromClubConfirmedAt);
  const toOk = Boolean(transfer.toClubConfirmedAt);
  return fromOk && toOk;
}

async function notifyClubsOfPendingTransfer(transfer, athlete) {
  try {
    const { createNotification } = require('../controllers/notifications');
    const athleteName = `${athlete?.firstName || ''} ${athlete?.lastName || ''}`.trim() || 'Atleti';
    const link = `/profile/${transfer.userId}?tab=about`;
    const targets = [];
    if (transfer.fromClubUserId) targets.push(Number(transfer.fromClubUserId));
    if (transfer.toClubUserId) targets.push(Number(transfer.toClubUserId));
    const unique = [...new Set(targets.filter((id) => Number.isFinite(id) && id > 0))];
    for (const clubUserId of unique) {
      const side =
        Number(clubUserId) === Number(transfer.fromClubUserId) ? 'klubi nisës' : 'klubi destinacion';
      await createNotification({
        userId: clubUserId,
        actorId: transfer.userId,
        type: 'system',
        title: 'Konfirmo transferin',
        message: `${athleteName} kërkon transfer. Nevojitet konfirmimi i ${side}: ${transfer.fromClub || 'Free agent'} → ${transfer.toClub}.`,
        link,
        entityType: 'transfer',
        entityId: transfer.id,
        metadata: { kind: 'transfer_confirm', transferId: transfer.id },
      });
    }
  } catch (err) {
    console.warn('notifyClubsOfPendingTransfer:', err?.message || err);
  }
}

async function notifyAthleteTransferResult(transfer, result) {
  try {
    const { createNotification } = require('../controllers/notifications');
    const title = result === 'confirmed' ? 'Transferi u konfirmua' : 'Transferi u refuzua';
    const message =
      result === 'confirmed'
        ? `Transferi ${transfer.fromClub || 'Free agent'} → ${transfer.toClub} u konfirmua nga të dy klubet. Klubi yt aktual u përditësua.`
        : `Transferi ${transfer.fromClub || 'Free agent'} → ${transfer.toClub} u refuzua nga një klub.`;
    await createNotification({
      userId: transfer.userId,
      type: 'system',
      title,
      message,
      link: `/profile/${transfer.userId}?tab=about`,
      entityType: 'transfer',
      entityId: transfer.id,
      metadata: { kind: 'transfer_result', status: result },
    });
  } catch (err) {
    console.warn('notifyAthleteTransferResult:', err?.message || err);
  }
}

async function finalizeIfReady(transfer) {
  if (!isFullyConfirmed(transfer) || String(transfer.status) === 'rejected') return transfer;
  if (String(transfer.status) !== 'confirmed') {
    await transfer.update({ status: 'confirmed' });
  }
  await syncProfileCurrentClubFromTransfer(transfer.userId, transfer);
  await notifyAthleteTransferResult(transfer, 'confirmed');
  return transfer.reload();
}

// Get user's transfer history
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId || isNaN(Number(userId))) {
      return res.status(400).json({ msg: 'Invalid userId parameter' });
    }
    try {
      const transfers = await TransferHistory.findAll({
        where: { userId: parseInt(userId, 10) },
        order: [
          ['transferDate', 'DESC'],
          ['id', 'DESC'],
        ],
      });
      return res.json(transfers);
    } catch (dbError) {
      console.error('[TransferHistory] DB Query Error:', dbError);
      const message = dbError?.message || '';
      if (
        message.includes('TransferHistories') ||
        message.includes('transferhistories') ||
        message.includes('does not exist')
      ) {
        return res.json([]);
      }
      return res.status(500).json({ msg: 'DB error', error: dbError.message });
    }
  } catch (error) {
    console.error('[TransferHistory] Route Handler Error:', error);
    res.status(500).json({ msg: 'Server error', error: error.message });
  }
});

// Pending transfers that need confirmation from the logged-in club
router.get('/pending-for-club', protect, async (req, res) => {
  try {
    if (String(req.user.role || '').toLowerCase() !== 'club') {
      return res.status(403).json({ msg: 'Vetëm klubet mund të shohin transferet në pritje.' });
    }
    const clubId = Number(req.user.id);
    const transfers = await TransferHistory.findAll({
      where: {
        status: 'pending',
        [Op.or]: [{ fromClubUserId: clubId }, { toClubUserId: clubId }],
      },
      include: [
        {
          model: User,
          attributes: ['id', 'firstName', 'lastName', 'role'],
          include: [{ model: Profile, attributes: ['profilePhoto', 'club', 'position'] }],
        },
      ],
      order: [
        ['createdAt', 'DESC'],
        ['id', 'DESC'],
      ],
    });
    res.json(transfers);
  } catch (error) {
    console.error('pending-for-club error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get transfers by club
router.get('/club/:clubName', async (req, res) => {
  try {
    const { clubName } = req.params;

    const transfers = await TransferHistory.findAll({
      where: {
        [Op.or]: [{ fromClub: clubName }, { toClub: clubName }],
      },
      include: [
        {
          model: User,
          attributes: ['id', 'firstName', 'lastName', 'role'],
          include: [{ model: Profile, attributes: ['profilePhoto'] }],
        },
      ],
      order: [['transferDate', 'DESC']],
    });

    res.json(transfers);
  } catch (error) {
    console.error('Get club transfer history error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Add transfer record (starts as pending until both clubs confirm)
router.post('/', protect, ...transferBodyValidators({ requireCore: true }), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ msg: 'Validation failed', errors: errors.array() });
  }
  try {
    const payload = normalizeTransferPayload(req.body);
    if (!payload.toClub) {
      return res.status(400).json({ msg: 'To club is required' });
    }
    if (!payload.season) {
      return res.status(400).json({ msg: 'Season is required' });
    }

    const toClubUserId =
      (await resolveClubId(payload.toClubUserId, payload.toClub)) || payload.toClubUserId || null;
    const fromClubUserId = payload.fromClub
      ? (await resolveClubId(payload.fromClubUserId, payload.fromClub)) || payload.fromClubUserId || null
      : null;

    payload.toClubUserId = toClubUserId;
    payload.fromClubUserId = fromClubUserId;

    const isAuto = payload.notes === CURRENT_CLUB_NOTE;
    const requiresDualConfirm =
      !isAuto && ['player_transfer', 'loan'].includes(String(payload.transferType || ''));

    if (requiresDualConfirm && !toClubUserId) {
      return res.status(400).json({
        msg: 'Zgjidh klubin destinacion nga lista (llogaria e klubit) që të mund të konfirmojë transferin.',
      });
    }
    if (requiresDualConfirm && payload.fromClub && !fromClubUserId) {
      return res.status(400).json({
        msg: 'Zgjidh klubin nisës nga lista (llogaria e klubit) që të mund të konfirmojë transferin, ose lëre bosh për Free agent.',
      });
    }

    const now = new Date();
    const status = isAuto || !requiresDualConfirm ? 'confirmed' : 'pending';
    const transfer = await TransferHistory.create({
      userId: req.user.id,
      ...payload,
      status,
      fromClubConfirmedAt: status === 'confirmed' || !needsFromClubConfirm(payload) ? now : null,
      toClubConfirmedAt: status === 'confirmed' ? now : null,
    });

    if (!isAuto) {
      try {
        // Keep previous club in history (do not delete the auto stint)
        await closeCurrentClubAutoStints(req.user.id, {
          endLabel: payload.season || String(new Date().getFullYear()),
        });
        await syncCareerHistoryFromTransfers(req.user.id, null, { force: true });
      } catch (_e) {
        /* non-fatal */
      }
    }

    if (status === 'confirmed') {
      try {
        await syncProfileCurrentClubFromTransfer(req.user.id, transfer);
      } catch (syncErr) {
        console.warn('Add transfer sync current club:', syncErr?.message || syncErr);
      }
    } else {
      const athlete = await User.findByPk(req.user.id, {
        attributes: ['id', 'firstName', 'lastName'],
      });
      await notifyClubsOfPendingTransfer(transfer, athlete);
    }

    res.status(201).json(transfer);
  } catch (error) {
    console.error('Add transfer error:', error);
    res.status(500).json({ msg: 'Server error', error: error.message });
  }
});

// Club confirms transfer (from or to club)
router.post('/:transferId/confirm', protect, async (req, res) => {
  await param('transferId').isInt({ min: 1 }).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ msg: 'Validation failed', errors: errors.array() });
  }
  try {
    if (String(req.user.role || '').toLowerCase() !== 'club' && req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Vetëm klubet mund të konfirmojnë transferet.' });
    }
    const transfer = await TransferHistory.findByPk(req.params.transferId);
    if (!transfer) return res.status(404).json({ msg: 'Transfer record not found' });
    if (String(transfer.status) !== 'pending') {
      return res.status(400).json({ msg: 'Ky transfer nuk është më në pritje.' });
    }

    const clubId = Number(req.user.id);
    const isFrom = Number(transfer.fromClubUserId) === clubId;
    const isTo = Number(transfer.toClubUserId) === clubId;
    if (!isFrom && !isTo && req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Ky klub nuk është palë në këtë transfer.' });
    }

    const now = new Date();
    const patch = {};
    if (isFrom || (req.user.role === 'admin' && needsFromClubConfirm(transfer) && !transfer.fromClubConfirmedAt)) {
      if (isFrom || req.user.role === 'admin') {
        patch.fromClubConfirmedAt = now;
        patch.fromClubConfirmedBy = clubId;
      }
    }
    if (isTo || (req.user.role === 'admin' && !transfer.toClubConfirmedAt)) {
      if (isTo || req.user.role === 'admin') {
        patch.toClubConfirmedAt = now;
        patch.toClubConfirmedBy = clubId;
      }
    }
    // Admin can confirm both sides
    if (req.user.role === 'admin') {
      if (needsFromClubConfirm(transfer)) {
        patch.fromClubConfirmedAt = now;
        patch.fromClubConfirmedBy = clubId;
      }
      patch.toClubConfirmedAt = now;
      patch.toClubConfirmedBy = clubId;
    }

    await transfer.update(patch);
    const updated = await finalizeIfReady(await transfer.reload());
    res.json(updated);
  } catch (error) {
    console.error('Confirm transfer error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Club rejects transfer
router.post('/:transferId/reject', protect, async (req, res) => {
  await param('transferId').isInt({ min: 1 }).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ msg: 'Validation failed', errors: errors.array() });
  }
  try {
    if (String(req.user.role || '').toLowerCase() !== 'club' && req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Vetëm klubet mund të refuzojnë transferet.' });
    }
    const transfer = await TransferHistory.findByPk(req.params.transferId);
    if (!transfer) return res.status(404).json({ msg: 'Transfer record not found' });
    if (String(transfer.status) !== 'pending') {
      return res.status(400).json({ msg: 'Ky transfer nuk është më në pritje.' });
    }

    const clubId = Number(req.user.id);
    const isFrom = Number(transfer.fromClubUserId) === clubId;
    const isTo = Number(transfer.toClubUserId) === clubId;
    if (!isFrom && !isTo && req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Ky klub nuk është palë në këtë transfer.' });
    }

    const reason = req.body?.reason != null ? String(req.body.reason).trim() : null;
    await transfer.update({
      status: 'rejected',
      rejectedAt: new Date(),
      rejectedByClubUserId: clubId,
      rejectionReason: reason || null,
    });
    await notifyAthleteTransferResult(transfer, 'rejected');
    res.json(transfer);
  } catch (error) {
    console.error('Reject transfer error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Update transfer record (athlete, only while pending or admin)
router.put('/:transferId', protect, ...transferBodyValidators({ requireCore: false }), async (req, res) => {
  await param('transferId').isInt({ min: 1 }).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ msg: 'Validation failed', errors: errors.array() });
  }
  try {
    const { transferId } = req.params;
    const transfer = await TransferHistory.findByPk(transferId);
    if (!transfer) {
      return res.status(404).json({ msg: 'Transfer record not found' });
    }
    if (Number(transfer.userId) !== Number(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Not authorized' });
    }
    if (String(transfer.status) === 'confirmed' && req.user.role !== 'admin') {
      return res.status(400).json({ msg: 'Transferi i konfirmuar nuk mund të ndryshohet.' });
    }
    const payload = normalizeTransferPayload({ ...transfer.toJSON(), ...req.body });
    await transfer.update({
      ...payload,
      // Reset confirmations if clubs changed while still pending
      ...(String(transfer.status) === 'pending'
        ? {
            fromClubConfirmedAt: null,
            fromClubConfirmedBy: null,
            toClubConfirmedAt: null,
            toClubConfirmedBy: null,
          }
        : {}),
    });
    res.json(transfer);
  } catch (error) {
    console.error('Update transfer error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Delete transfer record
router.delete('/:transferId', protect, async (req, res) => {
  await param('transferId').isInt({ min: 1 }).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ msg: 'Validation failed', errors: errors.array() });
  }
  try {
    const { transferId } = req.params;
    const transfer = await TransferHistory.findByPk(transferId);
    if (!transfer) {
      return res.status(404).json({ msg: 'Transfer record not found' });
    }
    if (Number(transfer.userId) !== Number(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Not authorized' });
    }
    const ownerId = transfer.userId;
    await transfer.destroy();
    try {
      await syncProfileCurrentClubFromLatestTransfer(ownerId);
    } catch (syncErr) {
      console.warn('Delete transfer sync current club:', syncErr?.message || syncErr);
    }
    res.json({ msg: 'Transfer record deleted' });
  } catch (error) {
    console.error('Delete transfer error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
