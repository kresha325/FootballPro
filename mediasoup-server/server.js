/**
 * DEPRECATED — MediaSoup SFU (legacy).
 * Primary live/call stack is LiveKit. See DEPRECATED.md.
 * Kept for rollback reference only; do not deploy for new environments.
 */
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mediasoup = require('mediasoup');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const allowedOrigin = process.env.MEDIASOUP_CORS_ORIGIN || process.env.FRONTEND_URL || '*';

function assertRequiredEnv() {
  const missing = [];

  if (!process.env.MEDIASOUP_ADMIN_TOKEN) {
    missing.push('MEDIASOUP_ADMIN_TOKEN');
  }

  if (!process.env.FOOTBALLPRO_API_URL) {
    missing.push('FOOTBALLPRO_API_URL');
  }

  if (missing.length > 0) {
    console.error(`[MediaSoup] Missing required environment variables: ${missing.join(', ')}`);
    console.error('[MediaSoup] Refusing to start. Set the missing variables and restart.');
    process.exit(1);
  }
}

assertRequiredEnv();

const io = socketIo(server, {
  cors: {
    origin: allowedOrigin,
    methods: ['GET', 'POST']
  }
});

let worker;
// Room structure: { [roomId]: { router, peers: { [socketId]: { transports, producers, consumers, userId } }, producerIds: { audio, video } } }
const rooms = {};

async function updateViewersInBackend(roomId, viewerCount) {
  const backendUrl = process.env.FOOTBALLPRO_API_URL || 'http://localhost:5000';
  const adminToken = process.env.MEDIASOUP_ADMIN_TOKEN || '';
  try {
    await axios.put(
      `${backendUrl}/api/streams/${roomId}/viewers`,
      { viewers: viewerCount },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
  } catch (err) {
    console.error('Failed to update viewer count:', err.message);
  }
}

async function endStreamInBackend(roomId) {
  const backendUrl = process.env.FOOTBALLPRO_API_URL || 'http://localhost:5000';
  const adminToken = process.env.MEDIASOUP_ADMIN_TOKEN || '';
  try {
    await axios.put(
      `${backendUrl}/api/streams/${roomId}/end-internal`,
      {},
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    console.log(`Stream ${roomId} marked as ended in backend.`);
  } catch (err) {
    console.error('Failed to update stream status in backend:', err.message);
  }
}

(async () => {
  worker = await mediasoup.createWorker();
  console.log('MediaSoup worker created');
})();

// Helper: get or create room
async function getOrCreateRoom(roomId) {
  if (!rooms[roomId]) {
    const router = await worker.createRouter({
      mediaCodecs: [
        {
          kind: 'audio',
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2
        },
        {
          kind: 'video',
          mimeType: 'video/VP8',
          clockRate: 90000
        }
      ]
    });
    rooms[roomId] = { router, peers: {}, producerIds: { audio: null, video: null } };
    console.log(`[MediaSoup] Created new room: ${roomId}`);
  }
  return rooms[roomId];
}

io.on('connection', (socket) => {
  console.log(`[MediaSoup] Client connected: ${socket.id}`);

  const userId = socket.handshake.query.userId || null;
  const jwtToken = socket.handshake.query.token || null;

  socket.on('joinRoom', async ({ roomId }, callback) => {
    const backendUrl = process.env.FOOTBALLPRO_API_URL || 'http://localhost:5000';

    if (!jwtToken) {
      return callback({ error: 'No token provided' });
    }

    try {
      const verifyRes = await axios.get(`${backendUrl}/api/auth/verify`, {
        headers: { Authorization: `Bearer ${jwtToken}` }
      });
      if (!verifyRes.data || !verifyRes.data.valid) {
        return callback({ error: 'Token invalid' });
      }
    } catch (err) {
      return callback({ error: 'Token verification failed' });
    }

    const room = await getOrCreateRoom(roomId);
    room.peers[socket.id] = { transports: [], producers: [], consumers: [], userId };
    console.log(`[MediaSoup] Peer joined room ${roomId}: socket=${socket.id}, userId=${userId}`);
    socket.join(roomId);

    const viewerCount = Object.values(room.peers).filter((p) => !p.producers || p.producers.length === 0).length;
    await updateViewersInBackend(roomId, viewerCount);
    callback({ joined: true, viewerCount });
  });

  socket.on('getRouterRtpCapabilities', async ({ roomId }, callback) => {
    const room = await getOrCreateRoom(roomId);
    callback(room.router.rtpCapabilities);
  });

  socket.on('createWebRtcTransport', async ({ roomId }, callback) => {
    const room = await getOrCreateRoom(roomId);
    const peer = room.peers[socket.id];
    if (!peer) return callback({ error: 'Peer not in room' });

    try {
      const transport = await room.router.createWebRtcTransport({
        listenIps: [{ ip: '0.0.0.0', announcedIp: process.env.ANNOUNCED_IP || null }],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true
      });

      peer.transports.push(transport);
      callback({
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters
      });

      transport.on('dtlsstatechange', (dtlsState) => {
        if (dtlsState === 'closed') transport.close();
      });
      transport.on('close', () => {});
    } catch (err) {
      console.error('createWebRtcTransport error', err);
      callback({ error: err.message });
    }
  });

  socket.on('connectTransport', async ({ roomId, transportId, dtlsParameters }, callback) => {
    const room = await getOrCreateRoom(roomId);
    const peer = room.peers[socket.id];
    if (!peer) return callback({ error: 'Peer not in room' });

    const transport = peer.transports.find((t) => t.id === transportId);
    if (!transport) return callback({ error: 'Transport not found' });

    await transport.connect({ dtlsParameters });
    callback('connected');
  });

  socket.on('produce', async ({ roomId, transportId, kind, rtpParameters }, callback) => {
    const room = await getOrCreateRoom(roomId);
    const peer = room.peers[socket.id];
    if (!peer) return callback({ error: 'Peer not in room' });

    const transport = peer.transports.find((t) => t.id === transportId);
    if (!transport) return callback({ error: 'Transport not found' });

    const producer = await transport.produce({ kind, rtpParameters });
    peer.producers.push(producer);
    if (kind === 'audio' || kind === 'video') {
      room.producerIds[kind] = producer.id;
    }

    producer.on('close', () => {
      if (kind === 'audio' && room.producerIds.audio === producer.id) room.producerIds.audio = null;
      if (kind === 'video' && room.producerIds.video === producer.id) room.producerIds.video = null;
    });

    console.log(`[MediaSoup] Producer created in room ${roomId}: socket=${socket.id}, kind=${kind}`);
    callback({ id: producer.id });
  });

  socket.on('consume', async ({ roomId, transportId, producerId, rtpCapabilities }, callback) => {
    const room = await getOrCreateRoom(roomId);
    const peer = room.peers[socket.id];
    if (!peer) return callback({ error: 'Peer not in room' });

    const transport = peer.transports.find((t) => t.id === transportId);
    if (!transport) return callback({ error: 'Transport not found' });

    if (!room.router.canConsume({ producerId, rtpCapabilities })) {
      return callback({ error: 'Cannot consume' });
    }

    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: false
    });

    peer.consumers.push(consumer);
    console.log(`[MediaSoup] Consumer created in room ${roomId}: socket=${socket.id}, kind=${consumer.kind}`);
    callback({
      id: consumer.id,
      producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters
    });
  });

  socket.on('disconnect', async () => {
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const peer = room.peers[socket.id];
      if (!peer) continue;

      console.log(`[MediaSoup] Peer leaving room ${roomId}: socket=${socket.id}, userId=${peer.userId}`);

      const activeProducerIds = Object.values(room.producerIds).filter(Boolean);
      const isBroadcaster = peer.producers.some((p) => activeProducerIds.includes(p.id));

      peer.transports.forEach((t) => {
        t.removeAllListeners && t.removeAllListeners();
        t.close && t.close();
      });
      peer.producers.forEach((p) => {
        p.removeAllListeners && p.removeAllListeners();
        p.close && p.close();
      });
      peer.consumers.forEach((c) => {
        c.removeAllListeners && c.removeAllListeners();
        c.close && c.close();
      });

      delete room.peers[socket.id];

      if (room.producerIds.audio && !Object.values(room.peers).some((p) => p.producers.some((prod) => prod.id === room.producerIds.audio))) {
        room.producerIds.audio = null;
      }
      if (room.producerIds.video && !Object.values(room.peers).some((p) => p.producers.some((prod) => prod.id === room.producerIds.video))) {
        room.producerIds.video = null;
      }

      const viewerCount = Object.values(room.peers).filter((p) => !p.producers || p.producers.length === 0).length;
      await updateViewersInBackend(roomId, viewerCount);

      if (isBroadcaster) {
        console.log(`[MediaSoup] Broadcaster left, ending stream for room ${roomId}`);
        await endStreamInBackend(roomId);
        io.to(roomId).emit('streamEnded', { roomId });
      }

      if (Object.keys(room.peers).length === 0) {
        console.log(`[MediaSoup] Room ${roomId} is now empty and deleted.`);
        delete rooms[roomId];
      }
    }

    socket.removeAllListeners && socket.removeAllListeners();
    console.log(`[MediaSoup] Client disconnected: ${socket.id}`);
  });
});

app.get('/api/mediasoup/health', (req, res) => {
  res.json({ status: 'ok', rooms: Object.keys(rooms).length });
});

app.get('/api/mediasoup/producers/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = rooms[roomId];
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const producers = Object.entries(room.producerIds)
    .filter(([, id]) => !!id)
    .map(([kind, id]) => ({ kind, producerId: id }));

  if (producers.length === 0) {
    return res.status(404).json({ error: 'No active producers' });
  }

  res.json({ producers });
});

// Backward-compatible endpoint for older clients.
app.get('/api/mediasoup/producer/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = rooms[roomId];
  const producerId = room && (room.producerIds.video || room.producerIds.audio);

  if (producerId) {
    res.json({ producerId });
  } else {
    res.status(404).json({ error: 'Producer not found' });
  }
});

const PORT = process.env.MEDIASOUP_PORT || 4000;
server.listen(PORT, () => {
  console.log(`MediaSoup server running on port ${PORT}`);
});
