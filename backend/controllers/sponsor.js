const db = require('../models');
const Sponsor = db.Sponsor;
const { toAbsoluteUploadsUrl } = require('../utils/url');

const serverError = (res, err) =>
  res.status(500).json({ msg: 'Gabim në server', error: err?.message });

// GET all sponsors (public)
exports.getAllSponsors = async (req, res) => {
  try {
    const sponsors = await Sponsor.findAll({
      order: [['startDate', 'DESC']]
    });
    const normalized = sponsors.map(s => {
      const sponsorObj = s.toJSON ? s.toJSON() : s;
      if (sponsorObj.image) {
        sponsorObj.image = toAbsoluteUploadsUrl(req, sponsorObj.image);
      }
      return sponsorObj;
    });
    res.json(normalized);
  } catch (err) {
    serverError(res, err);
  }
};

// GET all sponsors for a user
exports.getSponsorsByUser = async (req, res) => {
  try {
    const userId = req.params.userId;
    const sponsors = await Sponsor.findAll({
      where: { userId },
      order: [['startDate', 'DESC']]
    });
    const normalized = sponsors.map(s => {
      const sponsorObj = s.toJSON ? s.toJSON() : s;
      if (sponsorObj.image) {
        sponsorObj.image = toAbsoluteUploadsUrl(req, sponsorObj.image);
      }
      return sponsorObj;
    });
    res.json(normalized);
  } catch (err) {
    serverError(res, err);
  }
};

// POST create sponsor for a user (with file upload)
exports.createSponsor = async (req, res) => {
  try {
    const { userId, name, link, startDate, endDate, image } = req.body;
    const sponsor = await Sponsor.create({ userId, name, link, image, startDate, endDate });
    res.status(201).json(sponsor);
  } catch (err) {
    console.error('SPONSOR CREATE ERROR:', err);
    serverError(res, err);
  }
};

// PUT update sponsor
exports.updateSponsor = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, link, image, startDate, endDate } = req.body;
    const sponsor = await Sponsor.findByPk(id);
    if (!sponsor) return res.status(404).json({ msg: 'Sponsori nuk u gjet' });
    await sponsor.update({ name, link, image, startDate, endDate });
    res.json(sponsor);
  } catch (err) {
    serverError(res, err);
  }
};

// DELETE sponsor
exports.deleteSponsor = async (req, res) => {
  try {
    const { id } = req.params;
    const sponsor = await Sponsor.findByPk(id);
    if (!sponsor) return res.status(404).json({ msg: 'Sponsori nuk u gjet' });
    await sponsor.destroy();
    res.json({ msg: 'Sponsori u fshi' });
  } catch (err) {
    serverError(res, err);
  }
};
