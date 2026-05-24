const { resolveYoutubeChannelFromUrl } = require('../utils/youtubeChannel');

exports.resolveChannel = async (req, res) => {
  try {
    const raw = req.query.url || req.query.q || req.body?.url;
    if (!raw || !String(raw).trim()) {
      return res.status(400).json({ error: 'Vendos linkun e kanalit (@emri ose youtube.com/...)' });
    }

    const channelId = await resolveYoutubeChannelFromUrl(raw);
    if (!channelId) {
      return res.status(404).json({
        error: 'Nuk u gjet Channel ID. Kontrollo që kanali është publik dhe linku është i saktë.',
        hint: 'Përdor linkun nga YouTube → Kanali → Ndaj (Share).',
      });
    }

    res.json({
      channelId,
      channelUrl: `https://www.youtube.com/channel/${channelId}`,
    });
  } catch (err) {
    console.error('youtube resolve:', err.message);
    res.status(502).json({ error: 'Nuk u lidh me YouTube. Provo përsëri.' });
  }
};
