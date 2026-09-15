const { Op } = require('sequelize');
const Stadium = require('../models/Stadium');
const { toAbsoluteUploadsUrl } = require('../utils/url');

function parseCapacity(raw) {
  if (raw === '' || raw == null) return null;
  const n = parseInt(String(raw).replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
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

    const stadium = await Stadium.create({
      name,
      city: String(req.body.city || '').trim() || null,
      country: String(req.body.country || '').trim() || null,
      capacity: parseCapacity(req.body.capacity),
      address: String(req.body.address || '').trim() || null,
      photo: String(req.body.photo || '').trim() || null,
    });
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
    if (req.body.photo !== undefined) patch.photo = String(req.body.photo || '').trim() || null;

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
