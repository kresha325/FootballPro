const db = require('../models');
const path = require('path');
const os = require('os');
const { Op } = require('sequelize');
const Sponsor = db.Sponsor;
const User = db.User || require('../models/User');
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

/**
 * 1 active sponsor → Basic (365 days from sponsor end dates)
 * 2+ active sponsors → Premium
 * 0 → free
 */
async function syncSponsorMembership(userId) {
  const now = new Date();
  const active = await Sponsor.findAll({
    where: {
      userId,
      [Op.or]: [{ endDate: null }, { endDate: { [Op.gte]: now } }],
    },
    attributes: ['id', 'endDate'],
  });
  const count = active.length;
  let plan = 'free';
  if (count >= 2) plan = 'premium';
  else if (count === 1) plan = 'basic';

  let expiresAt = null;
  if (count > 0) {
    expiresAt = active.reduce((max, s) => {
      if (!s.endDate) return max;
      const d = new Date(s.endDate);
      return !max || d > max ? d : max;
    }, null);
    if (!expiresAt) {
      expiresAt = new Date(now);
      expiresAt.setDate(expiresAt.getDate() + 365);
    }
  }

  const user = await User.findByPk(userId);
  if (!user) return { plan: 'free', count: 0, expiresAt: null, premium: false, basic: false };

  user.subscriptionPlan = plan;
  user.premium = plan === 'premium';
  user.premiumExpiresAt = expiresAt;

  if (plan === 'premium') {
    try {
      const { syncOverallVerified } = require('../utils/userVerification');
      syncOverallVerified(user);
    } catch (_e) {
      /* ignore */
    }
  }

  try {
    await user.save();
  } catch (saveErr) {
    console.warn('syncSponsorMembership full save failed, retrying premium flag:', saveErr?.message || saveErr);
    try {
      await User.update({ premium: plan === 'premium' }, { where: { id: userId } });
    } catch (fbErr) {
      console.warn('syncSponsorMembership fallback failed:', fbErr?.message || fbErr);
    }
  }

  return {
    plan,
    count,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    premium: plan === 'premium',
    basic: plan === 'basic',
  };
}

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

exports.createSponsor = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ msg: 'Autorizimi u refuzua' });
    }
    const { name, link } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ msg: 'Emri i sponsorit është i detyrueshëm' });
    }
    const image = resolveUploadedImage(req);

    const resolvedStart = new Date();
    const resolvedEnd = new Date(resolvedStart);
    resolvedEnd.setDate(resolvedEnd.getDate() + 365);

    const sponsor = await Sponsor.create({
      userId: req.user.id,
      name: String(name).trim(),
      link,
      image,
      startDate: resolvedStart,
      endDate: resolvedEnd,
    });

    const membership = await syncSponsorMembership(req.user.id);

    const payload = sponsor.toJSON();
    payload.image = normalizeSponsorImage(req, payload.image);
    payload.subscriptionPlan = membership.plan;
    payload.sponsorCount = membership.count;
    payload.premiumGranted = membership.premium;
    payload.basicGranted = membership.basic;
    payload.premiumExpiresAt = membership.expiresAt;
    res.status(201).json(payload);
  } catch (err) {
    console.error('SPONSOR CREATE ERROR:', err);
    serverError(res, err);
  }
};

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
    const membership = await syncSponsorMembership(sponsor.userId);
    const payload = sponsor.toJSON();
    payload.image = normalizeSponsorImage(req, payload.image);
    payload.subscriptionPlan = membership.plan;
    payload.sponsorCount = membership.count;
    res.json(payload);
  } catch (err) {
    serverError(res, err);
  }
};

exports.deleteSponsor = async (req, res) => {
  try {
    const { id } = req.params;
    const sponsor = await Sponsor.findByPk(id);
    if (!sponsor) return res.status(404).json({ msg: 'Sponsori nuk u gjet' });
    if (!assertOwner(sponsor, req.user)) {
      return res.status(403).json({ msg: 'Nuk ke të drejtë të fshish këtë sponsor' });
    }
    const userId = sponsor.userId;
    await sponsor.destroy();
    const membership = await syncSponsorMembership(userId);
    res.json({
      msg: 'Sponsori u fshi',
      subscriptionPlan: membership.plan,
      sponsorCount: membership.count,
    });
  } catch (err) {
    serverError(res, err);
  }
};

exports.syncSponsorMembership = syncSponsorMembership;
