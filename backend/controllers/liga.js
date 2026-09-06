const Liga = require('../models/Liga');
const User = require('../models/User');
const { Tournament } = require('../models/Tournament');
const {
  ensureLigaTournament,
  normalizeCategory,
  ligaIncludesClub,
  addClubToList,
  removeClubFromList,
  syncClubAthletesToLiga,
  removeClubAthletesFromLiga,
} = require('../utils/ligaTournaments');

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

/** Club joins a liga (adds club userId to liga.clubs and syncs athletes). */
exports.joinLiga = async (req, res) => {
  try {
    if (req.user.role !== 'club') {
      return res.status(403).json({ msg: 'Vetëm klubet mund të bashkohen në ligë.' });
    }
    const liga = await Liga.findOne({ where: { userId: req.params.id } });
    if (!liga) return res.status(404).json({ msg: 'Liga nuk u gjet.' });

    if (ligaIncludesClub(liga, req.user.id)) {
      return res.status(200).json({ msg: 'Jeni tashmë në këtë ligë.', liga, alreadyJoined: true });
    }

    const { list } = addClubToList(liga.clubs, req.user.id);
    liga.clubs = list;
    liga.changed('clubs', true);
    await liga.save();

    try {
      await syncClubAthletesToLiga(liga, req.user.id);
    } catch (syncErr) {
      console.error('syncClubAthletesToLiga on join:', syncErr);
    }

    res.json({ msg: 'U bashkuat në ligë.', liga });
  } catch (err) {
    console.error('joinLiga:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

/** Club leaves a liga. */
exports.leaveLiga = async (req, res) => {
  try {
    if (req.user.role !== 'club') {
      return res.status(403).json({ msg: 'Vetëm klubet mund të largohen nga liga.' });
    }
    const liga = await Liga.findOne({ where: { userId: req.params.id } });
    if (!liga) return res.status(404).json({ msg: 'Liga nuk u gjet.' });

    if (!ligaIncludesClub(liga, req.user.id)) {
      return res.status(400).json({ msg: 'Nuk jeni anëtar i kësaj lige.' });
    }

    try {
      await removeClubAthletesFromLiga(liga, req.user.id);
    } catch (syncErr) {
      console.error('removeClubAthletesFromLiga on leave:', syncErr);
    }

    liga.clubs = removeClubFromList(liga.clubs, req.user.id);
    liga.changed('clubs', true);
    await liga.save();

    res.json({ msg: 'U larguat nga liga.', liga });
  } catch (err) {
    console.error('leaveLiga:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

/** Liga owner removes a club from the liga. */
exports.removeClubFromLiga = async (req, res) => {
  try {
    if (req.user.role !== 'liga') {
      return res.status(403).json({ msg: 'Vetëm liga mund të heqë klube.' });
    }
    const liga = await Liga.findOne({ where: { userId: req.user.id } });
    if (!liga) return res.status(404).json({ msg: 'Liga nuk u gjet.' });

    const clubId = req.params.clubId;
    if (!ligaIncludesClub(liga, clubId)) {
      return res.status(404).json({ msg: 'Klubi nuk është në këtë ligë.' });
    }

    try {
      await removeClubAthletesFromLiga(liga, clubId);
    } catch (syncErr) {
      console.error('removeClubAthletesFromLiga on remove:', syncErr);
    }

    liga.clubs = removeClubFromList(liga.clubs, clubId);
    liga.changed('clubs', true);
    await liga.save();

    res.json({ msg: 'Klubi u hoq nga liga.', liga });
  } catch (err) {
    console.error('removeClubFromLiga:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

/** Liga owner deletes their liga profile (and linked liga tournaments). */
exports.deleteLiga = async (req, res) => {
  try {
    if (req.user.role !== 'liga') {
      return res.status(403).json({ msg: 'Access denied' });
    }
    const liga = await Liga.findOne({ where: { userId: req.user.id } });
    if (!liga) return res.status(404).json({ msg: 'Liga nuk u gjet.' });

    await Tournament.destroy({ where: { ligaId: liga.id } });
    await liga.destroy();

    res.json({ msg: 'Liga u fshi.', success: true });
  } catch (err) {
    console.error('deleteLiga:', err);
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
