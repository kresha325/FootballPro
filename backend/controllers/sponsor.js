const db = require('../models');
const path = require('path');
const os = require('os');
const Sponsor = db.Sponsor;
const { toAbsoluteUploadsUrl } = require('../utils/url');

const serverError = (res, err) =>
  res.status(500).json({ msg: 'Gabim në server', error: err?.message });

/** Local OS temp paths must never be persisted or served as logo URLs. */
const isUnusableImagePath = (value) => {
  if (!value || typeof value !== 'string') return true;
  const s = value.trim();
  if (!s) return true;
  if (/^https?:\/\//i.test(s)) return false;
  if (s.includes('/uploads/') || s.startsWith('uploads/')) return false;
  const tmp = os.tmpdir() || '/tmp';
  if (s.startsWith('/tmp/') || s.startsWith(tmp) || s.includes('/var/folders/')) return true;
  // Absolute non-uploads filesystem paths
  if (path.isAbsolute(s) && !s.startsWith('/uploads/')) return true;
  return false;
};

const normalizeSponsorImage = (req, image) => {
  if (!image || isUnusableImagePath(image)) return null;
  return toAbsoluteUploadsUrl(req, image);
};

const normalizeSponsors = (req, sponsors) =>
  sponsors.map((s) => {
    const sponsorObj = s.toJSON ? s.toJSON() : { ...s };
    sponsorObj.image = normalizeSponsorImage(req, sponsorObj.image);
    return sponsorObj;
  });

/**
 * Prefer Cloudinary/local URL written onto req.body by upload middleware.
 * Never prefer multer's file.path (OS temp) — that was breaking sponsor logos.
 */
const resolveUploadedImage = (req) => {
  const bodyImage = typeof req.body?.image === 'string' ? req.body.image.trim() : '';
  if (bodyImage && !isUnusableImagePath(bodyImage)) {
    return bodyImage;
  }

  const file = req.files?.image?.[0] || req.file;
  if (!file) return null;

  if (file.secure_url && /^https?:\/\//i.test(file.secure_url)) return file.secure_url;
  if (file.url && /^https?:\/\//i.test(file.url)) return file.url;
  if (file.filename) return `/uploads/${file.filename}`;

  // Local uploads disk only (not OS temp)
  if (file.path && String(file.path).includes(`${path.sep}uploads${path.sep}`)) {
    return `/uploads/${path.basename(file.path)}`;
  }
  return null;
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
    const payload = sponsor.toJSON();
    payload.image = normalizeSponsorImage(req, payload.image);
    res.status(201).json(payload);
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
    const payload = sponsor.toJSON();
    payload.image = normalizeSponsorImage(req, payload.image);
    res.json(payload);
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
