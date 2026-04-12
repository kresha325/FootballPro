const { AccessToken } = require('livekit-server-sdk');

const DEFAULT_TTL_SECONDS = 60 * 60 * 2;

exports.createToken = async (req, res) => {
  try {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !wsUrl) {
      return res.status(500).json({
        msg: 'LiveKit is not configured. Missing LIVEKIT_URL/LIVEKIT_API_KEY/LIVEKIT_API_SECRET',
      });
    }

    const {
      roomName,
      participantName,
      metadata,
      canPublish = true,
      canSubscribe = true,
      canPublishData = true,
    } = req.body || {};

    if (!roomName || typeof roomName !== 'string') {
      return res.status(400).json({ msg: 'roomName is required' });
    }

    const identity = String(req.user?.id || req.user?.userId || participantName || 'guest');
    const displayName = participantName || `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim() || identity;

    const token = new AccessToken(apiKey, apiSecret, {
      identity,
      name: displayName,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
      ttl: DEFAULT_TTL_SECONDS,
    });

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish,
      canSubscribe,
      canPublishData,
    });

    return res.json({
      token: await token.toJwt(),
      wsUrl,
      roomName,
      identity,
      participantName: displayName,
    });
  } catch (error) {
    console.error('LiveKit token generation error:', error);
    return res.status(500).json({ msg: 'Failed to create LiveKit token' });
  }
};
