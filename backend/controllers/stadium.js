const { Op } = require('sequelize');
const Stadium = require('../models/Stadium');
const { toAbsoluteUploadsUrl } = require('../utils/url');

function parseCapacity(raw) {
  if (raw === '' || raw == null) return null;
  const n = parseInt(String(raw).replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

function parseBool(raw) {
  if (raw === true || raw === 1 || raw === '1' || raw === 'true' || raw === 'on') return true;
  if (raw === false || raw === 0 || raw === '0' || raw === 'false' || raw === 'off') return false;
  return null;
}

function parseDays(raw) {
  if (raw === '' || raw == null) return null;
  const n = parseInt(String(raw).replace(/[^\d]/g, ''), 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(n, 365);
}

/** Apply featured flag + optional days window (like Ads). */
function applyFeaturedFields(patch, body) {
  const featured = parseBool(body.featured);
  if (featured === null && body.featured === undefined) return;

  if (featured === false) {
    patch.featured = false;
    patch.featuredStart = null;
    patch.featuredEnd = null;
    return;
  }

  if (featured === true) {
    patch.featured = true;
    const days = parseDays(body.days) || parseDays(body.featuredDays) || 7;
    const start = new Date();
    const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
    patch.featuredStart = start;
    patch.featuredEnd = end;
  }
}

function serializeStadium(req, stadium) {
  if (!stadium) return null;
  const plain = typeof stadium.get === 'function' ? stadium.get({ plain: true }) : { ...stadium };
  return {
    ...plain,
    photo: plain.photo ? toAbsoluteUploadsUrl(req, plain.photo) : null,
  };
}

/** Authenticated list (clubs pick from catalog). Optional ?q= search. */
exports.listStadiums = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const dialect = Stadium.sequelize?.getDialect?.() || 'postgres';
    const likeOp = dialect === 'postgres' ? Op.iLike : Op.like;
    const where = q
      ? {
          [Op.or]: [
            { name: { [likeOp]: `%${q}%` } },
            { city: { [likeOp]: `%${q}%` } },
            { country: { [likeOp]: `%${q}%` } },
          ],
        }
      : undefined;
    const stadiums = await Stadium.findAll({
      where,
      order: [['name', 'ASC']],
      limit: Math.min(parseInt(req.query.limit, 10) || 100, 200),
    });
    res.json(stadiums.map((s) => serializeStadium(req, s)));
  } catch (err) {
    console.error('listStadiums:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

/** Featured stadiums currently active for Feed sidebar. */
exports.listFeaturedStadiums = async (req, res) => {
  try {
    const now = new Date();
    const stadiums = await Stadium.findAll({
      where: {
        featured: true,
        [Op.and]: [
          {
            [Op.or]: [{ featuredStart: null }, { featuredStart: { [Op.lte]: now } }],
          },
          {
            [Op.or]: [{ featuredEnd: null }, { featuredEnd: { [Op.gte]: now } }],
          },
        ],
      },
      order: [['featuredStart', 'DESC'], ['name', 'ASC']],
      limit: 50,
    });
    res.json(stadiums.map((s) => serializeStadium(req, s)));
  } catch (err) {
    console.error('listFeaturedStadiums:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

exports.getStadium = async (req, res) => {
  try {
    const stadium = await Stadium.findByPk(req.params.id);
    if (!stadium) return res.status(404).json({ msg: 'Stadiumi nuk u gjet.' });
    res.json(serializeStadium(req, stadium));
  } catch (err) {
    console.error('getStadium:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

exports.createStadium = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ msg: 'Emri i stadiumit është i detyrueshëm.' });

    const data = {
      name,
      city: String(req.body.city || '').trim() || null,
      country: String(req.body.country || '').trim() || null,
      capacity: parseCapacity(req.body.capacity),
      address: String(req.body.address || '').trim() || null,
      photo: String(req.body.photo || '').trim() || null,
      featured: false,
      featuredStart: null,
      featuredEnd: null,
    };
    applyFeaturedFields(data, req.body);

    const stadium = await Stadium.create(data);
    res.status(201).json(serializeStadium(req, stadium));
  } catch (err) {
    console.error('createStadium:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

exports.updateStadium = async (req, res) => {
  try {
    const stadium = await Stadium.findByPk(req.params.id);
    if (!stadium) return res.status(404).json({ msg: 'Stadiumi nuk u gjet.' });

    const patch = {};
    if (req.body.name !== undefined) {
      const name = String(req.body.name || '').trim();
      if (!name) return res.status(400).json({ msg: 'Emri i stadiumit është i detyrueshëm.' });
      patch.name = name;
    }
    if (req.body.city !== undefined) patch.city = String(req.body.city || '').trim() || null;
    if (req.body.country !== undefined) patch.country = String(req.body.country || '').trim() || null;
    if (req.body.capacity !== undefined) patch.capacity = parseCapacity(req.body.capacity);
    if (req.body.address !== undefined) patch.address = String(req.body.address || '').trim() || null;
    if (req.body.clearPhoto === '1' || req.body.clearPhoto === 'true') {
      patch.photo = null;
    } else if (req.body.photo !== undefined) {
      const p = String(req.body.photo || '').trim();
      if (p) patch.photo = p;
    }
    applyFeaturedFields(patch, req.body);

    await stadium.update(patch);
    res.json(serializeStadium(req, stadium));
  } catch (err) {
    console.error('updateStadium:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

exports.deleteStadium = async (req, res) => {
  try {
    const stadium = await Stadium.findByPk(req.params.id);
    if (!stadium) return res.status(404).json({ msg: 'Stadiumi nuk u gjet.' });
    await stadium.destroy();
    res.json({ msg: 'Stadiumi u fshi.' });
  } catch (err) {
    console.error('deleteStadium:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};
