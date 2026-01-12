// MediaSoup server basic structure for FootballPro
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mediasoup = require('mediasoup');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});


let worker;
// Room structure: { [roomId]: { router, peers: { [socketId]: { transports, producers, consumers, userId } }, producerId } }
const rooms = {};


(async () => {
  worker = await mediasoup.createWorker();
  console.log('MediaSoup worker created');
})();


// Store transports, producers, consumers per socket




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
    rooms[roomId] = { router, peers: {}, producerId: null };
    console.log(`[MediaSoup] Created new room: ${roomId}`);
  }
  return rooms[roomId];
}

io.on('connection', (socket) => {
  console.log(`[MediaSoup] Client connected: ${socket.id}`);

  // Autentikim: userId dhe JWT token nga query
  const userId = socket.handshake.query.userId || null;
  const jwtToken = socket.handshake.query.token || null;

  // Join room (roomId = streamId ose custom)
  socket.on('joinRoom', async ({ roomId }, callback) => {
    const axios = require('axios');
    const backendUrl = process.env.FOOTBALLPRO_API_URL || 'http://localhost:5000';
    // Verifiko JWT token me backend
    if (!jwtToken) {
      return callback({ error: 'No token provided' });
    }
    try {
      const verifyRes = await axios.get(`${backendUrl}/api/auth/verify`, {
        headers: { 'Authorization': `Bearer ${jwtToken}` }
      });
      if (!verifyRes.data || !verifyRes.data.valid) {
        return callback({ error: 'Token invalid' });
      }
    } catch (err) {
      return callback({ error: 'Token verification failed' });
    }
    // Nëse është valid, vazhdo
    const room = await getOrCreateRoom(roomId);
    room.peers[socket.id] = { transports: [], producers: [], consumers: [], userId };
    console.log(`[MediaSoup] Peer joined room ${roomId}: socket=${socket.id}, userId=${userId}`);
    socket.join(roomId);
    // Count viewers (exclude broadcaster)
    const viewerCount = Object.values(room.peers).filter(p => !p.producers || p.producers.length === 0).length;
    axios.put(`${backendUrl}/api/streams/${roomId}/viewers`, { viewers: viewerCount }, {
      headers: { 'Authorization': `Bearer ${process.env.MEDIASOUP_ADMIN_TOKEN || ''}` }
    }).catch(err => {
      console.error('Failed to update viewer count:', err.message);
    });
    callback({ joined: true, viewerCount });
  });

  // 1. Get router RTP capabilities
  socket.on('getRouterRtpCapabilities', async ({ roomId }, callback) => {
    const room = await getOrCreateRoom(roomId);
    callback(room.router.rtpCapabilities);
  });

  // 2. Create WebRTC transport
  socket.on('createWebRtcTransport', async ({ roomId, sender }, callback) => {
    const room = await getOrCreateRoom(roomId);
    try {
      const transport = await room.router.createWebRtcTransport({
        listenIps: [{ ip: '0.0.0.0', announcedIp: process.env.ANNOUNCED_IP || null }],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
      });
      room.peers[socket.id].transports.push(transport);
      callback({
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
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

  // 3. Connect transport (DTLS)
  socket.on('connectTransport', async ({ roomId, transportId, dtlsParameters }, callback) => {
    const room = await getOrCreateRoom(roomId);
    const transport = room.peers[socket.id].transports.find(t => t.id === transportId);
    if (!transport) return callback({ error: 'Transport not found' });
    await transport.connect({ dtlsParameters });
    callback('connected');
  });

  // 4. Produce (broadcaster)
  socket.on('produce', async ({ roomId, transportId, kind, rtpParameters }, callback) => {
    const room = await getOrCreateRoom(roomId);
    const transport = room.peers[socket.id].transports.find(t => t.id === transportId);
    if (!transport) return callback({ error: 'Transport not found' });
    const producer = await transport.produce({ kind, rtpParameters });
    console.log(`[MediaSoup] Producer created in room ${roomId}: socket=${socket.id}, kind=${kind}`);
    room.peers[socket.id].producers.push(producer);
    // Ruaj producerId në room për viewer-at
    if (!room.producerId) room.producerId = producer.id;
    callback({ id: producer.id });
  });

  // 5. Consume (viewer)
  socket.on('consume', async ({ roomId, transportId, producerId, rtpCapabilities }, callback) => {
    const room = await getOrCreateRoom(roomId);
    const transport = room.peers[socket.id].transports.find(t => t.id === transportId);
    if (!transport) return callback({ error: 'Transport not found' });
    if (!room.router.canConsume({ producerId, rtpCapabilities })) {
      return callback({ error: 'Cannot consume' });
    }
    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: false
    });
    room.peers[socket.id].consumers.push(consumer);
    console.log(`[MediaSoup] Consumer created in room ${roomId}: socket=${socket.id}, kind=${consumer.kind}`);
    callback({
      id: consumer.id,
      producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters
    });
  });

  socket.on('disconnect', () => {
    // Gjej dhomën ku ndodhet ky peer
    const axios = require('axios');
    for (const roomId in rooms) {
      const room = rooms[roomId];
      if (room.peers[socket.id]) {
        // Kontrollo nëse ky peer është broadcaster-i (ka producerId)
        console.log(`[MediaSoup] Peer leaving room ${roomId}: socket=${socket.id}, userId=${room.peers[socket.id].userId}`);
        const isBroadcaster = room.peers[socket.id].producers && room.peers[socket.id].producers.length > 0 && room.producerId && room.peers[socket.id].producers.some(p => p.id === room.producerId);
        // Pastrim i plotë i resurseve mediasoup
        room.peers[socket.id].transports.forEach(t => {
          t.removeAllListeners && t.removeAllListeners();
          t.close && t.close();
        });
        room.peers[socket.id].producers.forEach(p => {
          p.removeAllListeners && p.removeAllListeners();
          p.close && p.close();
        });
        room.peers[socket.id].consumers.forEach(c => {
          c.removeAllListeners && c.removeAllListeners();
          c.close && c.close();
        });
        // Pastrim i event listeners të socket-it
        socket.removeAllListeners && socket.removeAllListeners();
        delete room.peers[socket.id];
        // Update viewer count in backend (exclude broadcaster)
        const viewerCount = Object.values(room.peers).filter(p => !p.producers || p.producers.length === 0).length;
        const backendUrl = process.env.FOOTBALLPRO_API_URL || 'http://localhost:5000';
        axios.put(`${backendUrl}/api/streams/${roomId}/viewers`, { viewers: viewerCount }, {
          headers: { 'Authorization': `Bearer ${process.env.MEDIASOUP_ADMIN_TOKEN || ''}` }
        }).catch(err => {
          console.error('Failed to update viewer count:', err.message);
        });
        // Nëse ky ishte broadcaster-i, mbyll stream-in në backend dhe njofto viewer-at
        if (isBroadcaster) {
          console.log(`[MediaSoup] Broadcaster left, ending stream for room ${roomId}`);
          // Thirr backend-in për të bërë update isLive=false
          axios.put(`${backendUrl}/api/streams/${roomId}/end`, {}, {
            headers: { 'Authorization': `Bearer ${process.env.MEDIASOUP_ADMIN_TOKEN || ''}` }
          }).then(() => {
            console.log(`Stream ${roomId} marked as ended in backend.`);
          }).catch(err => {
            console.error('Failed to update stream status in backend:', err.message);
          });
          // Njofto viewer-at në këtë room që stream-i u mbyll
          io.to(roomId).emit('streamEnded', { roomId });
        }
        // Nëse dhoma është bosh, fshije
        if (Object.keys(room.peers).length === 0) {
          console.log(`[MediaSoup] Room ${roomId} is now empty and deleted.`);
          delete rooms[roomId];
        }
      }
    }
    console.log(`[MediaSoup] Client disconnected: ${socket.id}`);
  // Health check endpoint
  app.get('/api/mediasoup/health', (req, res) => {
    res.json({ status: 'ok', rooms: Object.keys(rooms).length });
  });
  });
});

// REST endpoint për të marrë producerId për një room/stream
app.get('/api/mediasoup/producer/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = rooms[roomId];
  if (room && room.producerId) {
    res.json({ producerId: room.producerId });
  } else {
    res.status(404).json({ error: 'Producer not found' });
  }
});

const PORT = process.env.MEDIASOUP_PORT || 4000;
server.listen(PORT, () => {
  console.log(`MediaSoup server running on port ${PORT}`);
});
