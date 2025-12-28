const axios = require('axios');

exports.getFixtures = async (req, res) => {
  try {
    const { league, season } = req.query;
    const response = await axios.get(`https://api.football-data.org/v4/competitions/${league}/matches?season=${season}`, {
      headers: {
        'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY
      }
    });
    res.json(response.data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error fetching fixtures' });
  }
};

exports.getStats = async (req, res) => {
  try {
    const { league, season } = req.query;
    const response = await axios.get(`https://api.football-data.org/v4/competitions/${league}/standings?season=${season}`, {
      headers: {
        'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY
      }
    });
    res.json(response.data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error fetching stats' });
  }
};

exports.getTeams = async (req, res) => {
  try {
    const { league } = req.query;
    const response = await axios.get(`https://api.football-data.org/v4/competitions/${league}/teams`, {
      headers: {
        'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY
      }
    });
    res.json(response.data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error fetching teams' });
  }
};