const axios = require('axios');

const CACHE_MS = 60 * 1000;
const cache = new Map();

function competitionCode(value) {
  const code = String(value || '').trim();
  if (!/^[A-Za-z0-9]{1,16}$/.test(code)) return null;
  return code;
}

function seasonYear(value) {
  if (value == null || value === '') return null;
  const year = String(value).trim();
  if (!/^\d{4}$/.test(year)) return null;
  return year;
}

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
}

function cacheSet(key, value) {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_MS });
}

async function loadCompetition(path, cacheKey) {
  const hit = cacheGet(cacheKey);
  if (hit !== undefined) return hit;
  const response = await axios.get(`https://api.football-data.org/v4/competitions/${path}`, {
    headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY },
    timeout: 10000,
  });
  cacheSet(cacheKey, response.data);
  return response.data;
}

function rejectQuery(res, message) {
  return res.status(400).json({ msg: message });
}

exports.getFixtures = async (req, res) => {
  try {
    const league = competitionCode(req.query.league);
    const season = seasonYear(req.query.season);
    if (!league) return rejectQuery(res, 'Invalid league');
    if (req.query.season != null && req.query.season !== '' && !season) {
      return rejectQuery(res, 'Invalid season');
    }
    const query = season ? `matches?season=${season}` : 'matches';
    const data = await loadCompetition(`${league}/${query}`, `fixtures:${league}:${season || ''}`);
    res.json(data);
  } catch (err) {
    console.error('Error fetching fixtures:', err && err.message);
    res.status(500).json({ msg: 'Error fetching fixtures' });
  }
};

exports.getStats = async (req, res) => {
  try {
    const league = competitionCode(req.query.league);
    const season = seasonYear(req.query.season);
    if (!league) return rejectQuery(res, 'Invalid league');
    if (req.query.season != null && req.query.season !== '' && !season) {
      return rejectQuery(res, 'Invalid season');
    }
    const query = season ? `standings?season=${season}` : 'standings';
    const data = await loadCompetition(`${league}/${query}`, `stats:${league}:${season || ''}`);
    res.json(data);
  } catch (err) {
    console.error('Error fetching stats:', err && err.message);
    res.status(500).json({ msg: 'Error fetching stats' });
  }
};

exports.getTeams = async (req, res) => {
  try {
    const league = competitionCode(req.query.league);
    if (!league) return rejectQuery(res, 'Invalid league');
    const data = await loadCompetition(`${league}/teams`, `teams:${league}`);
    res.json(data);
  } catch (err) {
    console.error('Error fetching teams:', err && err.message);
    res.status(500).json({ msg: 'Error fetching teams' });
  }
};
