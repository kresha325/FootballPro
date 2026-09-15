const db = require('../models');
const Sponsor = db.Sponsor;
const { toAbsoluteUploadsUrl } = require('../utils/url');

const serverError = (res, err) =>
  res.status(500).json({ msg: 'Gabim në server', error: err?.message });

const normalizeSponsors = (req, sponsors) =>
  sponsors.map((s) => {
    const sponsorObj = s.toJSON ? s.toJSON() : s;
    if (sponsorObj.image) {
      sponsorObj.image = toAbsoluteUploadsUrl(req, sponsorObj.image);
    }
    return sponsorObj;
  });

const resolveUploadedImage = (req) => {
  const file = req.files?.image?.[0] || req.file;
  if (!file) return req.body?.image || null;
  return file.path || file.secure_url || file.url || (file.filename ? `/uploads/${file.filename}` : null);
};

const assertOwner = (sponsor, user) => {
  if (!user?.id) return false;
  if (user.role === 'admin') return true;
  return Number(sponsor.userId) === Number(user.id);
};

// GET all sponsors (public)
exports.getAllSponsors = async (req, res) => {
  try {
    const sponsors = await Sponsor.findAll({
      order: [['startDate', 'DESC']],
    });
    res.json(normalizeSponsors(req, sponsors));
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
      order: [['startDate', 'DESC']],
    });
    res.json(normalizeSponsors(req, sponsors));
  } catch (err) {
    serverError(res, err);
  }
};

// POST create sponsor for a user (with file upload)
exports.createSponsor = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ msg: 'Autorizimi u refuzua' });
    }
    const { name, link, startDate, endDate } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ msg: 'Emri i sponsorit është i detyrueshëm' });
    }
    const image = resolveUploadedImage(req);
    const resolvedStart = startDate || new Date();
    const resolvedEnd =
      endDate ||
      new Date(new Date(resolvedStart).getTime() + 365 * 24 * 60 * 60 * 1000);
    const sponsor = await Sponsor.create({
      userId: req.user.id,
      name: String(name).trim(),
      link,
      image,
      startDate: resolvedStart,
      endDate: resolvedEnd,
    });
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
    const { name, link, startDate, endDate } = req.body;
    const sponsor = await Sponsor.findByPk(id);
    if (!sponsor) return res.status(404).json({ msg: 'Sponsori nuk u gjet' });
    if (!assertOwner(sponsor, req.user)) {
      return res.status(403).json({ msg: 'Nuk ke të drejtë të ndryshosh këtë sponsor' });
    }
    const image = resolveUploadedImage(req);
    await sponsor.update({
      name: name ?? sponsor.name,
      link: link ?? sponsor.link,
      image: image ?? sponsor.image,
      startDate: startDate ?? sponsor.startDate,
      endDate: endDate ?? sponsor.endDate,
    });
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
    if (!assertOwner(sponsor, req.user)) {
      return res.status(403).json({ msg: 'Nuk ke të drejtë të fshish këtë sponsor' });
    }
    await sponsor.destroy();
    res.json({ msg: 'Sponsori u fshi' });
  } catch (err) {
    serverError(res, err);
  }
};
