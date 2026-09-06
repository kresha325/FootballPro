const Liga = require('../models/Liga');
const User = require('../models/User');
const { ensureLigaTournament, normalizeCategory } = require('../utils/ligaTournaments');

// Create Liga profile
exports.createLiga = async (req, res) => {
  try {
    if (req.user.role !== 'liga') {
      return res.status(403).json({ msg: 'Access denied' });
    }
    const existingLiga = await Liga.findOne({ where: { userId: req.user.id } });
    if (existingLiga) {
      return res.status(400).json({ msg: 'Liga profile already exists' });
    }
    const liga = await Liga.create({
      userId: req.user.id,
      name: req.body.name,
      logo: req.body.logo,
      country: req.body.country,
      level: req.body.level,
      foundedYear: req.body.foundedYear,
      description: req.body.description,
      website: req.body.website,
      clubs: req.body.clubs,
      competitions: req.body.competitions,
      contact: req.body.contact,
      socialLinks: req.body.socialLinks,
    });
    try {
      await ensureLigaTournament(liga, {
        category: normalizeCategory(req.body.category || req.body.competitionCategory || 'open'),
      });
    } catch (tourErr) {
      console.error('ensureLigaTournament on create:', tourErr);
    }
    res.status(201).json(liga);
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// Get Liga profile by userId
exports.getLiga = async (req, res) => {
  try {
    const userId = req.params.id || req.user.id;
    const liga = await Liga.findOne({
      where: { userId },
      include: [{ model: User, attributes: ['id', 'role', 'email'] }],
    });
    if (!liga) {
      return res.status(404).json({ msg: 'Liga profile not found' });
    }
    res.json(liga);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// Update Liga profile (create if missing — upsert for first-time liga users)
exports.updateLiga = async (req, res) => {
  try {
    if (req.user.role !== 'liga') {
      return res.status(403).json({ msg: 'Access denied' });
    }
    let liga = await Liga.findOne({ where: { userId: req.user.id } });
    const fields = {
      name: req.body.name,
      logo: req.body.logo,
      country: req.body.country,
      level: req.body.level,
      foundedYear: req.body.foundedYear ? parseInt(req.body.foundedYear, 10) : undefined,
      description: req.body.description,
      website: req.body.website,
      clubs: req.body.clubs,
      competitions: req.body.competitions,
      contact: req.body.contact,
      socialLinks: req.body.socialLinks,
    };

    // FormData may send JSON fields as strings
    ['clubs', 'competitions', 'contact', 'socialLinks'].forEach((key) => {
      if (typeof fields[key] === 'string') {
        try {
          fields[key] = JSON.parse(fields[key]);
        } catch {
          /* keep string */
        }
      }
    });

    const category = normalizeCategory(req.body.category || req.body.competitionCategory || 'open');

    if (!liga) {
      liga = await Liga.create({
        userId: req.user.id,
        name: fields.name || 'Liga',
        level: fields.level || 'other',
        logo: fields.logo || null,
        country: fields.country || null,
        foundedYear: fields.foundedYear || null,
        description: fields.description || null,
        website: fields.website || null,
        clubs: fields.clubs || [],
        competitions: fields.competitions || [],
        contact: fields.contact || {},
        socialLinks: fields.socialLinks || {},
      });
      try {
        await ensureLigaTournament(liga, { category });
      } catch (tourErr) {
        console.error('ensureLigaTournament on upsert:', tourErr);
      }
      return res.json(liga);
    }

    await liga.update({
      name: fields.name || liga.name,
      logo: fields.logo !== undefined && fields.logo !== '' ? fields.logo : liga.logo,
      country: fields.country || liga.country,
      level: fields.level || liga.level,
      foundedYear: fields.foundedYear || liga.foundedYear,
      description: fields.description || liga.description,
      website: fields.website || liga.website,
      clubs: fields.clubs || liga.clubs,
      competitions: fields.competitions || liga.competitions,
      contact: fields.contact || liga.contact,
      socialLinks: fields.socialLinks || liga.socialLinks,
    });
    try {
      await ensureLigaTournament(liga, { category });
    } catch (tourErr) {
      console.error('ensureLigaTournament on update:', tourErr);
    }
    res.json(liga);
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// List all Liga profiles
exports.getAllLigas = async (req, res) => {
  try {
    const ligas = await Liga.findAll({
      include: [{ model: User, attributes: ['id', 'role', 'email'] }],
      order: [['createdAt', 'DESC']]
    });
    res.json(ligas);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};
