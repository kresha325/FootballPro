
// Debug: Log Match model attributes and associations at startup
const db = require('./models');
if (db.Match) {
  console.log('Match model attributes:', Object.keys(db.Match.rawAttributes));
  console.log('Match model associations:', Object.keys(db.Match.associations));
}
// Fshi reklamat e skaduara çdo 1 orë
const deleteExpiredAds = require('./utils/deleteExpiredAds');
setInterval(deleteExpiredAds, 60 * 60 * 1000);
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const https = require('https');
const fs = require('fs');
const socketIo = require('socket.io');
const passport = require('./config/passport');
// const sequelize = require('./config/database');

dotenv.config();

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


const app = express();
let server = http.createServer(app);
let io;
const PORT = process.env.PORT || 10000;

// CORS configuration
const allowedOrigin = process.env.CORS_ORIGIN || '*'; // Vendos URL-n e frontend-it në .env për prodhim
app.use(cors({
  origin: allowedOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept'],
  credentials: true
}));
app.options('*', cors());

// Socket.io CORS
io = socketIo(server, {
  cors: {
    origin: allowedOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
  }
});
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(passport.initialize());

// Serve static files from uploads directory (now from 'uploads' at project root)
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ...frontend serving removed for Render split-service deployment...

// Routes

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
app.use('/api/search', require('./routes/search'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/gamification', require('./routes/gamification'));
app.use('/api/scouting', require('./routes/scouting'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/ads', require('./routes/ads'));
app.use('/api/video-calls', require('./routes/videoCalls'));
// ...existing code...
app.use('/api/videos', require('./routes/videos'));
app.use('/api/tournaments', require('./routes/tournaments'));
app.use('/api/matches', require('./routes/matches'));
app.use('/api/matches', require('./routes/matchScorers'));
app.use('/api/user-matches', require('./routes/matchesUser'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));

app.use('/api/football', require('./routes/football'));
app.use('/api/club-members', require('./routes/clubMembers'));
app.use('/api/club-roster', require('./routes/clubRoster'));
app.use('/api/transfer-history', require('./routes/transferHistory'));
app.use('/api/sponsors', require('./routes/sponsor'));
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

app.get('/', (req, res) => {
  res.send('JONSPORT Backend API');
});

// Socket.IO for real-time messaging and video calls
// Store user socket mappings
const userSockets = new Map(); // userId -> socketId

io.on('connection', (socket) => {
    // Multi-user call: join room and log call start
    socket.on('call:join-room', async (data) => {
      const { roomId, userId } = data;
      socket.join(roomId);
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
      io.to(roomId).emit('call:user-joined', { userId });
    });
  console.log('✅ User connected:', socket.id);

  // Store user authentication from handshake
  const userId = socket.handshake.auth.userId;
  
  // Join user's room for private messaging
  socket.on('join', (uid) => {
    const userIdToJoin = uid || userId;
    if (userIdToJoin) {
      socket.userId = userIdToJoin;
      socket.join(String(userIdToJoin));
      userSockets.set(String(userIdToJoin), socket.id);
      console.log(`👤 User ${userIdToJoin} joined room ${userIdToJoin}`);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    if (socket.userId) {
      userSockets.delete(String(socket.userId));
      console.log(`👤 User ${socket.userId} disconnected`);
    }
    console.log('❌ Socket disconnected:', socket.id);
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
    const { to, offer, from, callerName } = data;
    const targetSocketId = userSockets.get(String(to));
    
    if (targetSocketId) {
      console.log(`📞 Call offer from user ${from} to user ${to}`);
      io.to(String(to)).emit('call:incoming', {
        from,
        callerName,
        offer,
      });
    } else {
      console.log(`❌ User ${to} not connected`);
      socket.emit('call:failed', { reason: 'User not available' });
    }
  });

  socket.on('call:answer', (data) => {
    const { to, answer } = data;
    console.log(`✅ Call answer from user ${socket.userId} to user ${to}`);
    io.to(String(to)).emit('call:answered', {
      from: socket.userId,
      answer,
    });
  });

  socket.on('call:ice-candidate', (data) => {
    const { to, candidate } = data;
    io.to(String(to)).emit('call:ice-candidate', {
      from: socket.userId,
      candidate,
    });
  });

  socket.on('call:reject', (data) => {
    const { to } = data;
    console.log(`❌ Call rejected by user ${socket.userId}`);
    io.to(String(to)).emit('call:rejected', {
      from: socket.userId,
    });
  });

  socket.on('call:end', async (data) => {
    const { to } = data;
    console.log(`📴 Call ended by user ${socket.userId}`);
    if (to) {
      io.to(String(to)).emit('call:ended', {
        from: socket.userId,
      });
    }
    // Mark call as ended in DB (for all rooms this user is in)
    const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
    for (const roomId of rooms) {
      const call = await VideoCallHistory.findOne({ where: { roomId, endedAt: null } });
      if (call) {
        call.endedAt = new Date();
        await call.save();
      }
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
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});