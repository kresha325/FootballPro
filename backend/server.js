// ...existing code...

const express = require('express');
const cors = require('cors');
const { helmet, rateLimit, xss, mongoSanitize } = require('./config/security');
const dotenv = require('dotenv');
const http = require('http');
const https = require('https');
const fs = require('fs');
const socketIo = require('socket.io');
const passport = require('./config/passport');
const morgan = require('morgan');
// const sequelize = require('./config/database');

dotenv.config();

// Simple socket event logger
function logSocketEvent(socket, event, details) {
  try {
    const sid = socket && socket.id ? socket.id : 'no-socket';
    const t = new Date().toISOString();
    console.log(`[${t}] [socket:${sid}] ${event} -`, details || {});
  } catch (e) {
    console.log('Logger error:', e && e.message);
  }
}
// When behind a proxy (Render, Heroku, etc.) trust the proxy so req.ip is correct
// This avoids many clients appearing to come from the same IP and hitting the rate limiter

const app = express();
// trust proxy must be set after app is created
app.set('trust proxy', 1);
let server = http.createServer(app);
let io;
const PORT = process.env.PORT || 10000;

// CORS is configured centrally below using the `cors` package so preflight and
// actual responses always return consistent, valid headers. The explicit
// header middleware was removed to avoid duplication and invalid responses.

// Debug: Log Match model attributes and associations at startup
const db = require('./models');
if (db.Match) {
  console.log('Match model attributes:', Object.keys(db.Match.rawAttributes));
  console.log('Match model associations:', Object.keys(db.Match.associations));
}
// Fshi reklamat e skaduara çdo 1 orë
const deleteExpiredAds = require('./utils/deleteExpiredAds');
setInterval(deleteExpiredAds, 60 * 60 * 1000);
// Import models
const User = require('./models/User');
const Achievement = require('./models/Achievement');
const Badge = require('./models/Badge');
const Reward = require('./models/Reward');
const UserAchievement = require('./models/UserAchievement');
const UserBadge = require('./models/UserBadge');
const UserReward = require('./models/UserReward');
const Notification = require('./models/Notification');
const Follow = require('./models/Follow');
const Profile = require('./models/Profile');
const { Conversation, ConversationMember } = require('./models/Conversation');
const Message = require('./models/Message');
const { VideoCallHistory } = require('./models');
// Add other models as needed

const sequelize = require('./config/database');
const { QueryTypes } = require('sequelize');

// `uploads` static assets are served below; global CORS middleware will set
// the appropriate headers for those responses. Do not set headers twice.

// Helmet for HTTP headers
app.use(helmet());

// Rate limiting (per IP). Note: behind proxies (Render) set `trust proxy` above
// Increased default to reduce false-positives on shared IP hosts; consider using a
// centralized store (Redis) for multi-instance deployments.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`Rate limit exceeded for IP ${req.ip} on ${req.originalUrl}`);
    res.status(429).json({ msg: 'Too many requests, please try again later.' });
  }
});

// Allow disabling the global rate limiter via env var for platforms where you
// control access differently (e.g. Render). Set RATE_LIMIT_ENABLED=false to disable.
const rateLimitEnabled = process.env.RATE_LIMIT_ENABLED !== 'false';
if (rateLimitEnabled) {
  app.use(limiter);
} else {
  console.log('Rate limiting disabled (RATE_LIMIT_ENABLED=false) - global limiter not applied.');
}

// XSS protection
app.use(xss());

// NoSQL/SQL injection protection
app.use(mongoSanitize());

// CORS configuration: use a dynamic origin function so preflight and actual
// responses consistently return a valid Access-Control-Allow-Origin. In
// development we allow requests from any origin; in production only configured
// origins are accepted.
const allowedOrigin = process.env.CORS_ORIGIN || 'https://footballpro-1.onrender.com'; // set in .env for prod
const allowedOrigins = allowedOrigin === '*'
  ? ['*']
  : allowedOrigin.split(',').map((origin) => origin.trim()).filter(Boolean);

function dynamicOrigin(origin, callback) {
  // No origin (server-to-server or same-origin tools) -> allow
  if (!origin) return callback(null, true);
  // Development: allow any origin (echo handled by cors package)
  if (process.env.NODE_ENV !== 'production') return callback(null, true);
  // Production: only allow configured origins
  if (allowedOrigins.includes(origin)) return callback(null, true);
  return callback(new Error('Not allowed by CORS'));
}

app.use(cors({
  origin: dynamicOrigin,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept'],
  credentials: true,
  optionsSuccessStatus: 200,
}));
app.options('*', cors());

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Socket.io CORS — socket.io accepts an array or '*' for origin.
const socketCorsOrigin = (allowedOrigins.length === 1 && allowedOrigins[0] === '*') ? '*' : allowedOrigins;
io = socketIo(server, {
  cors: {
    origin: socketCorsOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true
  }
});
// Make io available to other modules
try {
  const socketUtil = require('./utils/socket');
  socketUtil.setIo(io);
} catch (e) {
  console.warn('Could not set io in utils/socket:', e && e.message);
}

// Stripe webhook must receive raw body (before express.json)
const { stripeWebhook } = require('./controllers/stripePayments');
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(passport.initialize());

// Serve static files from uploads directory (now from 'uploads' at project root)
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Fallback placeholder for missing uploads (avoid CORB on 404)
app.use('/uploads', (req, res) => {
  const placeholder = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIW2NgYGBgAAAABQABDQottAAAAABJRU5ErkJggg==',
    'base64'
  );
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Access-Control-Allow-Origin', 'https://footballpro-1.onrender.com');
  res.status(200).send(placeholder);
});

// Serve favicon and frontend public icons so browser gets icon on all routes
try {
  const frontendPublic = path.join(__dirname, '..', 'frontend', 'public');
  app.get('/favicon.ico', (req, res) => {
    const p = path.join(frontendPublic, 'footballpro-icon-192.png');
    if (fs.existsSync(p)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      return res.sendFile(p);
    }
    return res.sendStatus(404);
  });
  app.get('/footballpro-icon-192.png', (req, res) => {
    const p = path.join(frontendPublic, 'footballpro-icon-192.png');
    if (fs.existsSync(p)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      return res.sendFile(p);
    }
    return res.sendStatus(404);
  });
  // Serve apple-touch-icon and other static icons
  const iconsDir = path.join(frontendPublic, 'icons');
  if (fs.existsSync(iconsDir)) {
    app.use('/icons', express.static(iconsDir, { maxAge: '30d' }));
  }
} catch (e) {
  console.warn('Could not mount frontend public icons:', e && e.message);
}

// ...frontend serving removed for Render split-service deployment...

// Routes

app.use('/api/config', require('./routes/config'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/profiles', require('./routes/profiles'));
app.use('/api/gallery', require('./routes/gallery'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/likes', require('./routes/likes'));
app.use('/api/messaging', require('./routes/messaging'));
app.use('/api/messaging', require('./routes/messagingUnread'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/premium', require('./routes/premium'));
app.use('/api/search', require('./routes/search'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/gamification', require('./routes/gamification'));
app.use('/api/scouting', require('./routes/scouting'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/ads', require('./routes/ads'));
app.use('/api/video-calls', require('./routes/videoCalls'));
app.use('/api/videos', require('./routes/videos'));
app.use('/api/tournaments', require('./routes/tournaments'));
app.use('/api/matches', require('./routes/matches'));
app.use('/api/matches', require('./routes/matchScorers'));
app.use('/api/user-matches', require('./routes/matchesUser'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));

app.use('/api/football', require('./routes/football'));
app.use('/api/live-chat', require('./routes/liveChat'));
app.use('/api/live-reaction', require('./routes/liveReaction'));
app.use('/api/live-stream', require('./routes/liveStream'));
app.use('/api/live-stream-guest', require('./routes/liveStreamGuest'));
app.use('/api/live-stream-analytics', require('./routes/liveStreamAnalytics'));
app.use('/api/live-chat-moderation', require('./routes/liveChatModeration'));
app.use('/api/live-stream-notification', require('./routes/liveStreamNotification'));
app.use('/api/live-donation', require('./routes/liveDonation'));
app.use('/api/scheduled-live-stream', require('./routes/scheduledLiveStream'));
app.use('/api/live-stream-replay', require('./routes/liveStreamReplay'));
app.use('/api/club-members', require('./routes/clubMembers'));
app.use('/api/club-roster', require('./routes/clubRoster'));
app.use('/api/verification', require('./routes/verification'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/youtube', require('./routes/youtube'));
app.use('/api/transfer-history', require('./routes/transferHistory'));
app.use('/api/sponsors', require('./routes/sponsor'));
app.use('/api/livekit', require('./routes/livekit'));
app.use('/api/club-staff', require('./routes/clubStaff'));
app.use('/api/national-teams', require('./routes/nationalTeams'));

// Role-based profile routes
app.use('/api/athletes', require('./routes/athlete'));
app.use('/api/coaches', require('./routes/coach'));
app.use('/api/scouts', require('./routes/scout'));
app.use('/api/managers', require('./routes/manager'));
app.use('/api/clubs', require('./routes/club'));
app.use('/api/federations', require('./routes/federation'));
app.use('/api/medias', require('./routes/media'));
app.use('/api/businesses', require('./routes/business'));

app.use('/api/ligas', require('./routes/liga'));

// Streams routes (live/recording)
app.use('/api/streams', require('./routes/streams'));

// JonCoin API
app.use('/api/joncoin', require('./routes/joncoin'));


// Endpoint për të kontrolluar nëse një user është online
app.get('/api/users/:userId/online', (req, res) => {
  try {
    const { userId } = req.params;
    // userSockets është në scope global të server.js
    const isOnline = userSockets.has(String(userId));
    res.json({ userId, online: isOnline });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => {
  res.send('JONSPORT Backend API');
});

// Socket.IO for real-time messaging and video calls
// Store user socket mappings
const userSockets = new Map(); // userId -> socketId

const VideoCall = require('./models/VideoCall');

io.on('connection', (socket) => {
    // Multi-user call: join room and log call start
    socket.on('call:join-room', async (data) => {
      const { roomId, userId } = data;
      socket.join(roomId);
      try {
        // Find or create call history for this room
        let call = await VideoCallHistory.findOne({ where: { roomId, endedAt: null } });
        if (!call) {
          call = await VideoCallHistory.create({
            roomId,
            participants: [userId],
            startedAt: new Date(),
            status: 'completed',
          });
        } else {
          // Add user to participants if not already present
          const participants = Array.isArray(call.participants) ? call.participants : [];
          if (!participants.includes(userId)) {
            participants.push(userId);
            call.participants = participants;
            await call.save();
          }
        }
      } catch (err) {
        console.warn('⚠️ VideoCallHistory not available:', err.message);
      }
      io.to(roomId).emit('call:user-joined', { userId });
    });
  logSocketEvent(socket, 'connected', { userId: socket.handshake.auth.userId });

  // Store user authentication from handshake
  const userId = socket.handshake.auth.userId;
  
  // Join user's room for private messaging
  socket.on('join', (uid) => {
    const userIdToJoin = uid || userId;
    if (userIdToJoin) {
      socket.userId = userIdToJoin;
      socket.join(String(userIdToJoin));
      userSockets.set(String(userIdToJoin), socket.id);
      logSocketEvent(socket, 'join', { userId: userIdToJoin, room: String(userIdToJoin) });
    }
  });

  // Subscribe to stream events (frontend uses this to receive live updates)
  socket.on('subscribe:streams', () => {
    try {
      socket.join('streams');
      logSocketEvent(socket, 'subscribe:streams', { socketId: socket.id });
    } catch (e) {
      console.warn('subscribe:streams error:', e && e.message);
    }
  });

  socket.on('unsubscribe:streams', () => {
    try {
      socket.leave('streams');
      logSocketEvent(socket, 'unsubscribe:streams', { socketId: socket.id });
    } catch (e) {}
  });

  // Subscribe to a specific stream room to receive viewer updates
  socket.on('subscribe:stream', (streamId) => {
    try {
      if (streamId) {
        socket.join(`stream:${streamId}`);
        logSocketEvent(socket, 'subscribe:stream', { streamId, socketId: socket.id });
      }
    } catch (e) {
      console.warn('subscribe:stream error:', e && e.message);
    }
  });

  socket.on('unsubscribe:stream', (streamId) => {
    try {
      if (streamId) socket.leave(`stream:${streamId}`);
    } catch (e) {}
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    if (socket.userId) {
      userSockets.delete(String(socket.userId));
      logSocketEvent(socket, 'disconnect', { userId: socket.userId });
    }
    logSocketEvent(socket, 'socket-disconnected', {});
  });

  // Handle notifications
  socket.on('notificationRead', async (notificationId) => {
    // Broadcast to other devices of same user
    socket.broadcast.to(socket.userId).emit('notificationRead', notificationId);
  });

  // Handle new message
  socket.on('sendMessage', (data) => {
    const { conversationId, message } = data;
    io.to(`conversation-${conversationId}`).emit('newMessage', message);
  });

  // Join conversation room
  socket.on('joinConversation', (conversationId) => {
    socket.join(`conversation-${conversationId}`);
  });

  // Leave conversation room
  socket.on('leaveConversation', (conversationId) => {
    socket.leave(`conversation-${conversationId}`);
  });

  // Typing indicator
  socket.on('typing', (data) => {
    const { conversationId, userId, userName } = data;
    socket.to(`conversation-${conversationId}`).emit('userTyping', { userId, userName });
  });

  socket.on('stopTyping', (data) => {
    const { conversationId, userId } = data;
    socket.to(`conversation-${conversationId}`).emit('userStoppedTyping', { userId });
  });

  // WebRTC signaling for video calls
  socket.on('call:offer', (data) => {
    const { to, offer, from, callerName, callId } = data;
    const targetSocketId = userSockets.get(String(to));
    (async () => {
      let usedCallId = callId;
      try {
        // If no callId provided, create a VideoCall fallback so server-side records exist
        if (!usedCallId) {
          try {
            const created = await VideoCall.create({
              callerId: from,
              receiverId: to,
              status: 'ringing',
              startTime: new Date(),
            });
            usedCallId = created.id;
            logSocketEvent(socket, 'call:fallback-created', { callId: usedCallId, from, to });

            // Try to persist a message into conversation (best-effort)
            try {
              const sql = `SELECT "conversationId" FROM "ConversationMembers" WHERE "userId" IN (:a,:b) GROUP BY "conversationId" HAVING COUNT("userId") = 2 LIMIT 1`;
              const convoMatches = await sequelize.query(sql, {
                replacements: { a: from, b: to },
                type: QueryTypes.SELECT,
              });
              let conversationId = null;
              if (convoMatches && convoMatches.length > 0) {
                conversationId = convoMatches[0].conversationId || convoMatches[0].conversationid || convoMatches[0].conversation_id;
              }
              if (!conversationId) {
                const t = await sequelize.transaction();
                try {
                  const newConv = await Conversation.create({ isGroup: false }, { transaction: t });
                  await ConversationMember.bulkCreate([
                    { conversationId: newConv.id, userId: from },
                    { conversationId: newConv.id, userId: to },
                  ], { transaction: t });
                  await t.commit();
                  conversationId = newConv.id;
                  logSocketEvent(socket, 'conversation-created-for-call', { conversationId, callId: usedCallId });
                } catch (txErr) {
                  await t.rollback();
                  console.warn('Failed to create conversation for call fallback:', txErr && txErr.message);
                }
              }
              if (conversationId) {
                const callMessage = await Message.create({
                  conversationId,
                  senderId: from,
                  content: `Call started`,
                  type: 'call',
                  metadata: { callId: usedCallId, event: 'started' },
                });
                await Conversation.update({ lastMessageAt: new Date() }, { where: { id: conversationId } });
                logSocketEvent(socket, 'call-message-saved', { callId: usedCallId, messageId: callMessage.id });
              }
            } catch (msgErr) {
              console.warn('Failed to persist call fallback message:', msgErr && msgErr.message);
            }
          } catch (createErr) {
            console.warn('Failed to create VideoCall fallback:', createErr && createErr.message);
          }
        }

        if (targetSocketId) {
          logSocketEvent(socket, 'call:offer', { from, to, callId: usedCallId, targetSocketId });
          io.to(String(to)).emit('call:incoming', {
            from,
            callerName,
            offer,
            callId: usedCallId,
          });
        } else {
          logSocketEvent(socket, 'call:offer-failed', { from, to, callId: usedCallId, reason: 'User not connected' });
          socket.emit('call:failed', { reason: 'User not available' });
        }
      } catch (outerErr) {
        console.error('Error handling call:offer fallback:', outerErr && outerErr.stack ? outerErr.stack : outerErr);
        socket.emit('call:failed', { reason: 'Server error' });
      }
    })();
  });

  socket.on('call:answer', (data) => {
    (async () => {
      let { to, answer, callId } = data;
      logSocketEvent(socket, 'call:answer-received', { from: socket.userId, to, callId });

      // If 'to' is missing but callId is present, try to resolve the recipient from DB
      if ((!to || String(to) === 'undefined') && callId) {
        try {
          const vc = await VideoCall.findByPk(callId);
          if (vc) {
            // If current socket is receiver, forward to caller; otherwise forward to receiver
            to = (socket.userId && socket.userId === String(vc.receiverId)) ? vc.callerId : vc.receiverId;
            logSocketEvent(socket, 'call:answer-resolved-recipient', { callId, resolvedTo: to });
          }
        } catch (resolveErr) {
          console.warn('Failed to resolve call recipient for answer:', resolveErr && resolveErr.message);
        }
      }

      if (!to) {
        logSocketEvent(socket, 'call:answer-no-recipient', { from: socket.userId, callId });
        socket.emit('call:failed', { reason: 'Recipient not found for answer' });
        return;
      }

      logSocketEvent(socket, 'call:answer-forwarding', { from: socket.userId, to, callId });
      io.to(String(to)).emit('call:answered', {
        from: socket.userId,
        answer,
        callId,
      });

      // If a callId was provided, mark the VideoCall as connected
      if (callId) {
        try {
          const vc = await VideoCall.findByPk(callId);
          if (vc) {
            vc.status = 'connected';
            vc.connectedAt = new Date();
            await vc.save();
            // Notify participants that call is confirmed connected in DB
            try {
              io.to(String(vc.callerId)).emit('call:connected', { callId: vc.id });
              io.to(String(vc.receiverId)).emit('call:connected', { callId: vc.id });
            } catch (emitErr) {
              console.warn('Failed to emit call:connected:', emitErr.message);
            }
          }
        } catch (e) {
          console.warn('Failed to update VideoCall on answer:', e.message);
        }
      }
    })();
  });

  socket.on('call:ice-candidate', (data) => {
    const { to, candidate } = data;
    logSocketEvent(socket, 'call:ice-candidate', { to, hasCandidate: !!candidate });
    io.to(String(to)).emit('call:ice-candidate', {
      from: socket.userId,
      candidate,
    });
  });

  socket.on('call:reject', (data) => {
    const { to } = data;
    logSocketEvent(socket, 'call:reject', { to });
    io.to(String(to)).emit('call:rejected', {
      from: socket.userId,
    });
  });

  socket.on('call:end', async (data) => {
    const { to } = data;
    logSocketEvent(socket, 'call:end', { to });
    if (to) {
      io.to(String(to)).emit('call:ended', {
        from: socket.userId,
      });
    }
    // Mark call as ended in DB (for all rooms this user is in)
    try {
      const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
      for (const roomId of rooms) {
        const call = await VideoCallHistory.findOne({ where: { roomId, endedAt: null } });
        if (call) {
          call.endedAt = new Date();
          await call.save();
        }
      }
    } catch (err) {
      console.warn('⚠️ VideoCallHistory not available:', err.message);
    }
  });

  // ...existing code...

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Sync database
// Define associations
User.hasMany(UserAchievement, { foreignKey: 'userId' });
UserAchievement.belongsTo(User, { foreignKey: 'userId' });
Achievement.hasMany(UserAchievement, { foreignKey: 'achievementId' });
UserAchievement.belongsTo(Achievement, { foreignKey: 'achievementId' });

User.hasMany(UserBadge, { foreignKey: 'userId' });
UserBadge.belongsTo(User, { foreignKey: 'userId' });
Badge.hasMany(UserBadge, { foreignKey: 'badgeId' });
UserBadge.belongsTo(Badge, { foreignKey: 'badgeId' });

User.hasMany(UserReward, { foreignKey: 'userId' });
UserReward.belongsTo(User, { foreignKey: 'userId' });
Reward.hasMany(UserReward, { foreignKey: 'rewardId' });
UserReward.belongsTo(Reward, { foreignKey: 'rewardId' });

Reward.belongsTo(Badge, { foreignKey: 'badgeId' });

/*sequelize.sync({alter: true}).then(() => {
  console.log('Database synced');
}).catch(err => console.log('DB sync error:', err));*/

// DB connection test only
sequelize.authenticate()
  .then(() => {
    console.log('✅ Database connected');
    // Migrimet ekzekutohen vetëm me CLI, jo nga kodi.
  })
  .catch(err => console.error('❌ Database connection error:', err));


if (!PORT) {
  console.error('❌ PORT environment variable is not set.');
  process.exit(1);
}
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

// Error handling middleware (duhet të jetë në fund të file-it)
app.use((err, req, res, next) => {
  console.error('❌ Express error:', err);
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Max 10MB.' });
  }
  if (err && err.message === 'Invalid file type') {
    return res.status(400).json({ error: 'Invalid file type.' });
  }
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});
// Expose io to controllers via helper
try {
  require('./socket').setIo(io);
} catch (e) {
  console.warn('Could not set io in socket helper', e && e.message);
}