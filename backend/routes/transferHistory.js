const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const TransferHistory = require('../models/TransferHistory');
const User = require('../models/User');
const Profile = require('../models/Profile');

// Get user's transfer history
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const transfers = await TransferHistory.findAll({
      where: { userId: parseInt(userId) },
      order: [['transferDate', 'DESC']],
    });

    res.json(transfers);
  } catch (error) {
    console.error('Get transfer history error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get transfers by club
router.get('/club/:clubName', async (req, res) => {
  try {
    const { clubName } = req.params;
    
    const transfers = await TransferHistory.findAll({
      where: {
        [require('sequelize').Op.or]: [
          { fromClub: clubName },
          { toClub: clubName }
        ]
      },
      include: [{
        model: User,
        attributes: ['id', 'firstName', 'lastName', 'role'],
        include: [{ model: Profile, attributes: ['profilePhoto'] }]
      }],
      order: [['transferDate', 'DESC']],
    });

    res.json(transfers);
  } catch (error) {
    console.error('Get club transfer history error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Add transfer record
router.post('/', protect, async (req, res) => {
  try {
    const { transferType, fromClub, toClub, position, season, transferDate, transferFee, contractUntil, notes } = req.body;

    const transfer = await TransferHistory.create({
      userId: req.user.id,
      transferType,
      fromClub,
      toClub,
      position,
      season,
      transferDate: transferDate || new Date(),
      transferFee,
      contractUntil,
      notes,
    });

    res.status(201).json(transfer);
  } catch (error) {
    console.error('Add transfer error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Update transfer record
router.put('/:transferId', protect, async (req, res) => {
  try {
    const { transferId } = req.params;
    const transfer = await TransferHistory.findByPk(transferId);

    if (!transfer) {
      return res.status(404).json({ msg: 'Transfer record not found' });
    }

    if (transfer.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    await transfer.update(req.body);
    res.json(transfer);
  } catch (error) {
    console.error('Update transfer error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Delete transfer record
router.delete('/:transferId', protect, async (req, res) => {
  try {
    const { transferId } = req.params;
    const transfer = await TransferHistory.findByPk(transferId);

    if (!transfer) {
      return res.status(404).json({ msg: 'Transfer record not found' });
    }

    if (transfer.userId !== req.user.id && req.user.role !== 'admin') {
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
