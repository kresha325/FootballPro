// Merr statistikat totale të përdoruesit për ndeshjet e tij
exports.getUserMatchStats = async (req, res) => {
  try {
    const userId = req.user.id;
    // Merr të gjitha ndeshjet ku useri është homeUserId ose awayUserId
    const matches = await Match.findAll({
      where: {
        [Match.sequelize.Op.or]: [
          { homeUserId: userId },
          { awayUserId: userId }
        ]
      }
    });
    const totalMatches = matches.length;
    let totalGoals = 0;
    let totalAssists = 0;
    let totalMinutes = 0;
    matches.forEach(m => {
      totalGoals += m.goals || 0;
      totalAssists += m.assists || 0;
      // minutesPlayed mund të jetë string, p.sh. "90+", "40"
      if (m.minutesPlayed) {
        const min = parseInt(m.minutesPlayed);
        if (!isNaN(min)) totalMinutes += min;
      }
    });
    // Performance: bazuar në gola, asiste dhe minuta (shembull i thjeshtë)
    let performance = 0;
    if (totalMatches > 0) {
      performance = Math.round(((totalGoals * 2 + totalAssists) / (totalMatches * 3)) * 100);
    }
    // Goal per match
    let goalPerMatch = 0;
    if (totalMatches > 0) {
      goalPerMatch = Math.round((totalGoals / totalMatches) * 100);
    }
    res.json({
      totalMatches,
      totalGoals,
      totalAssists,
      totalMinutes,
      performance: performance > 100 ? 100 : performance,
      goalPerMatch: goalPerMatch > 100 ? 100 : goalPerMatch
    });
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};
const Match = require('../models/Match');
const User = require('../models/User');

// Krijo ndeshje të thjeshtë për përdoruesin
exports.createMatch = async (req, res) => {
  try {
    const { homeTeam, awayTeam, date, time, location, description } = req.body;
    // Mund të shtosh edhe userId nga req.user.id nëse është i nevojshëm
    const match = await Match.create({
      homeTeam,
      awayTeam,
      matchDate: date ? new Date(`${date}T${time || '00:00'}`) : null,
      location,
      description,
      status: 'scheduled',
    });
    res.status(201).json(match);
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// Merr të gjitha ndeshjet e përdoruesit
exports.getMatches = async (req, res) => {
  try {
    const matches = await Match.findAll();
    res.json(matches);
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};
