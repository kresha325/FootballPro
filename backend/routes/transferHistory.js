console.log('[TransferHistory] Route file loaded');
const express = require('express');
const { body, param, validationResult } = require('express-validator');
const router = express.Router();
const { protect } = require('../middleware/auth');
const TransferHistory = require('../models/TransferHistory');
const User = require('../models/User');
const Profile = require('../models/Profile');

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

// Get transfers by club
router.get('/club/:clubName', async (req, res) => {
  try {
    const { clubName } = req.params;

    const transfers = await TransferHistory.findAll({
      where: {
        [require('sequelize').Op.or]: [{ fromClub: clubName }, { toClub: clubName }],
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

// Add transfer record
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
    const transfer = await TransferHistory.create({
      userId: req.user.id,
      ...payload,
    });
    res.status(201).json(transfer);
  } catch (error) {
    console.error('Add transfer error:', error);
    res.status(500).json({ msg: 'Server error', error: error.message });
  }
});

// Update transfer record
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
    const payload = normalizeTransferPayload({ ...transfer.toJSON(), ...req.body });
    await transfer.update(payload);
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
    await transfer.destroy();
    res.json({ msg: 'Transfer record deleted' });
  } catch (error) {
    console.error('Delete transfer error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
