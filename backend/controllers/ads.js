const { Ad } = require('../models');
const { toAbsoluteUploadsUrl } = require('../utils/url');

/** Pricing: €1 per day covers 3s of media. Video 12s → €4/day. Total = pricePerDay × campaign days. */
const EUR_PER_UNIT = 1;
const SECONDS_PER_UNIT = 3;

function unitsFromSeconds(sec) {
  const n = Number(sec) || 0;
  if (n <= 0) return 1;
  return Math.max(1, Math.ceil(n / SECONDS_PER_UNIT));
}

function computeAdPricing(daysRaw, mediaDurationSec) {
  const days = Math.max(1, parseInt(String(daysRaw || '1'), 10) || 1);
  const mediaSec = mediaDurationSec != null && mediaDurationSec !== ''
    ? Math.max(0, Number(mediaDurationSec))
    : null;
  const hasMediaSec = mediaSec && mediaSec > 0;
  const pricePerDay = hasMediaSec ? unitsFromSeconds(mediaSec) * EUR_PER_UNIT : EUR_PER_UNIT;
  const displaySeconds = hasMediaSec ? Math.round(mediaSec) : SECONDS_PER_UNIT;
  return {
    days,
    displaySeconds,
    pricePerDay,
    priceEur: pricePerDay * days,
    mediaDurationSec: hasMediaSec ? Math.round(mediaSec) : null,
  };
}

function normalizeAd(req, ad) {
  const adObj = ad.toJSON ? ad.toJSON() : { ...ad };
  if (adObj.imageUrl) adObj.imageUrl = toAbsoluteUploadsUrl(req, adObj.imageUrl);
  if (adObj.videoUrl) adObj.videoUrl = toAbsoluteUploadsUrl(req, adObj.videoUrl);
  adObj.displaySeconds = Number(adObj.displaySeconds) || SECONDS_PER_UNIT;
  adObj.priceEur = Number(adObj.priceEur) || EUR_PER_UNIT;
  return adObj;
}

// GET all active ads
exports.getActiveAds = async (req, res) => {
  try {
    const now = new Date();
    const ads = await Ad.findAll({
      where: {
        startDate: { [require('sequelize').Op.lte]: now },
        endDate: { [require('sequelize').Op.gte]: now },
      },
      order: [['createdAt', 'DESC']],
    });
    res.json(ads.map((ad) => normalizeAd(req, ad)));
  } catch (err) {
    console.error('❌ Error in getActiveAds:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};

// POST create ad
exports.createAd = async (req, res) => {
  try {
    const { title, text, color, days, image, video, mediaDurationSec } = req.body;
    if (!title || !text || !days) return res.status(400).json({ error: 'Missing fields' });

    const pricing = computeAdPricing(days, mediaDurationSec);
    const now = new Date();
    const startDate = now;
    const endDate = new Date(startDate.getTime() + pricing.days * 24 * 60 * 60 * 1000);

    const imageUrl = (typeof image === 'string' && image.trim()) || null;
    const videoUrl = (typeof video === 'string' && video.trim()) || null;
    const mediaType = videoUrl ? 'video' : 'image';

    const ad = await Ad.create({
      title: String(title).trim(),
      text: String(text).trim(),
      color: color || '#34d399',
      startDate,
      endDate,
      imageUrl,
      videoUrl,
      mediaType,
      displaySeconds: pricing.displaySeconds,
      priceEur: pricing.priceEur,
      mediaDurationSec: pricing.mediaDurationSec,
    });

    res.status(201).json(normalizeAd(req, ad));
  } catch (err) {
    console.error('❌ Error in createAd:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};

exports.EUR_PER_UNIT = EUR_PER_UNIT;
exports.SECONDS_PER_UNIT = SECONDS_PER_UNIT;
exports.unitsFromSeconds = unitsFromSeconds;
exports.computeAdPricing = computeAdPricing;
