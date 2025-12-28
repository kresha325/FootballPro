const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const NationalTeam = require('../models/NationalTeam');
const User = require('../models/User');
const Profile = require('../models/Profile');

// Get national team squad
router.get('/:nationalTeamId', async (req, res) => {
  try {
    const { nationalTeamId } = req.params;
    const { teamCategory, status } = req.query;

    const where = { nationalTeamId: parseInt(nationalTeamId) };
    if (teamCategory) where.teamCategory = teamCategory;
    if (status) where.status = status;

    const squad = await NationalTeam.findAll({
      where,
      include: [{
        model: User,
        as: 'player',
        attributes: ['id', 'firstName', 'lastName', 'gender', 'dateOfBirth'],
        include: [{ 
          model: Profile, 
          attributes: ['profilePhoto', 'position', 'club', 'age', 'ageGroup'] 
        }]
      }],
      order: [['jerseyNumber', 'ASC']],
    });

    res.json(squad);
  } catch (error) {
    console.error('Get national team squad error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get player's national team history
router.get('/player/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;

    const nationalTeams = await NationalTeam.findAll({
      where: { playerId: parseInt(playerId) },
      include: [{
        model: User,
        as: 'nationalTeam',
        attributes: ['id', 'firstName', 'lastName'],
        include: [{ model: Profile, attributes: ['club', 'profilePhoto', 'country'] }]
      }],
      order: [['debutDate', 'DESC']],
    });

    res.json(nationalTeams);
  } catch (error) {
    console.error('Get player national teams error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Add player to national team (national team managers only)
router.post('/', protect, async (req, res) => {
  try {
    const { playerId, teamCategory, position, jerseyNumber } = req.body;

    // Check if already exists
    const existing = await NationalTeam.findOne({
      where: {
        nationalTeamId: req.user.id,
        playerId: parseInt(playerId),
        teamCategory,
        status: 'active'
      }
    });

    if (existing) {
      return res.status(400).json({ msg: 'Player already in this national team category' });
    }

    const member = await NationalTeam.create({
      nationalTeamId: req.user.id,
      playerId: parseInt(playerId),
      teamCategory,
      position,
      jerseyNumber,
      status: 'pending',
    });

    const result = await NationalTeam.findByPk(member.id, {
      include: [{
        model: User,
        as: 'player',
        attributes: ['id', 'firstName', 'lastName', 'gender', 'dateOfBirth'],
        include: [{ model: Profile, attributes: ['profilePhoto', 'position', 'club', 'age', 'ageGroup'] }]
      }]
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Add national team player error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Update player details (national team managers only)
router.patch('/:memberId', protect, async (req, res) => {
  try {
    const { memberId } = req.params;
    const member = await NationalTeam.findByPk(memberId);

    if (!member) {
      return res.status(404).json({ msg: 'Player not found' });
    }

    if (member.nationalTeamId !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    const { status, position, jerseyNumber, capsEarned, goals, captaincy } = req.body;
    
    if (status) member.status = status;
    if (position) member.position = position;
    if (jerseyNumber !== undefined) member.jerseyNumber = jerseyNumber;
    if (capsEarned !== undefined) member.capsEarned = capsEarned;
    if (goals !== undefined) member.goals = goals;
    if (captaincy !== undefined) member.captaincy = captaincy;
    
    if (status === 'active' && !member.debutDate) {
      member.debutDate = new Date();
    }

    await member.save();

    const result = await NationalTeam.findByPk(memberId, {
      include: [{
        model: User,
        as: 'player',
        attributes: ['id', 'firstName', 'lastName', 'gender', 'dateOfBirth'],
        include: [{ model: Profile, attributes: ['profilePhoto', 'position', 'club', 'age', 'ageGroup'] }]
      }]
    });

    res.json(result);
  } catch (error) {
    console.error('Update national team player error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Remove player from national team (national team managers only)
router.delete('/:memberId', protect, async (req, res) => {
  try {
    const { memberId } = req.params;
    const member = await NationalTeam.findByPk(memberId);

    if (!member) {
      return res.status(404).json({ msg: 'Player not found' });
    }

    if (member.nationalTeamId !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    await member.destroy();
    res.json({ msg: 'Player removed from national team' });
  } catch (error) {
    console.error('Remove national team player error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
