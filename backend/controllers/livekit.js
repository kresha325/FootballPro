const crypto = require('crypto');
const { AccessToken } = require('livekit-server-sdk');
const { authorizeLiveKitRoom, authorizeAnonymousStreamViewer } = require('../utils/livekitAcl');

const DEFAULT_TTL_SECONDS = 60 * 60 * 2;

exports.createToken = async (req, res) => {
  try {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !wsUrl) {
      return res.status(500).json({
        msg: 'LiveKit nuk është i konfiguruar. Mungojnë LIVEKIT_URL/LIVEKIT_API_KEY/LIVEKIT_API_SECRET',
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
      return res.status(400).json({ msg: 'roomName është i detyrueshëm' });
    }

    const userId = req.user?.id || req.user?.userId;
    let access;
    let identity;
    if (!userId) {
      if (canPublish) {
        return res.status(401).json({ msg: 'Autentikimi është i detyrueshëm' });
      }
      access = await authorizeAnonymousStreamViewer(roomName);
      identity = `anon-${crypto.randomBytes(8).toString('hex')}`;
    } else {
      access = await authorizeLiveKitRoom(userId, roomName, {
        canPublish: !!canPublish,
      });
      identity = String(userId);
    }
    if (!access.ok) {
      return res.status(access.status).json({ msg: access.msg });
    }

    // Viewers must not publish; owners/call participants keep requested publish flag.
    const publishAllowed =
      access.role === 'viewer' ? false : !!canPublish;
    const displayName =
      participantName ||
      `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim() ||
      identity;

    const token = new AccessToken(apiKey, apiSecret, {
      identity,
      name: displayName,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
      ttl: DEFAULT_TTL_SECONDS,
    });

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: publishAllowed,
      canSubscribe: !!canSubscribe,
      canPublishData: publishAllowed ? !!canPublishData : false,
    });

    return res.json({
      token: await token.toJwt(),
      wsUrl,
      roomName,
      identity,
      participantName: displayName,
      role: access.role,
    });
  } catch (error) {
    console.error('LiveKit token generation error:', error);
    return res.status(500).json({ msg: 'Nuk u arrit krijimi i tokenit LiveKit' });
  }
};
