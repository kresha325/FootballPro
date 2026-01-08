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
// Add other models as needed

const sequelize = require('./config/database');

const app = express();
let server;
let io;
const PORT = process.env.PORT || 5098;
const sslKeyPath = './certs/server.key';
const sslCertPath = './certs/server.cert';
if (fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
  const sslOptions = {
    key: fs.readFileSync(sslKeyPath),
    cert: fs.readFileSync(sslCertPath)
  };
  server = https.createServer(sslOptions, app);
  console.log('🔒 HTTPS enabled');
} else {
  server = http.createServer(app);
  console.log('⚠️  HTTPS certs not found, running in HTTP');
}
io = socketIo(server, {
  cors: {
    origin: "*", // Allow all origins for development/testing
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  }
});

app.use(cors({
  origin: "*", // Allow all origins for development/testing
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(passport.initialize());

// Serve static files from uploads directory
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/profiles', require('./routes/profiles'));
app.use('/api/gallery', require('./routes/gallery'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/likes', require('./routes/likes'));
app.use('/api/messaging', require('./routes/messaging'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/search', require('./routes/search'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/scouting', require('./routes/scouting'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/ads', require('./routes/ads'));
app.use('/api/video-calls', require('./routes/videoCalls'));
app.use('/api/streams', require('./routes/streams'));
app.use('/api/videos', require('./routes/videos'));
app.use('/api/tournaments', require('./routes/tournaments'));
app.use('/api/matches', require('./routes/matches'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));

app.use('/api/football', require('./routes/football'));
app.use('/api/club-members', require('./routes/clubMembers'));
app.use('/api/club-roster', require('./routes/clubRoster'));
app.use('/api/transfer-history', require('./routes/transferHistory'));
app.use('/api/sponsors', require('./routes/sponsor'));
app.use('/api/club-staff', require('./routes/clubStaff'));
app.use('/api/national-teams', require('./routes/nationalTeams'));

app.get('/', (req, res) => {
  res.send('JONSPORT Backend API');
});

// Socket.IO for real-time messaging and video calls
// Store user socket mappings
const userSockets = new Map(); // userId -> socketId

io.on('connection', (socket) => {
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

  socket.on('call:end', (data) => {
    const { to } = data;
    console.log(`📴 Call ended by user ${socket.userId}`);
    if (to) {
      io.to(String(to)).emit('call:ended', {
        from: socket.userId,
      });
    }
  });

  // Live streaming
  socket.on('joinStream', (streamId) => {
    socket.join(`stream-${streamId}`);
    io.to(`stream-${streamId}`).emit('viewerJoined', socket.id);
  });

  socket.on('leaveStream', (streamId) => {
    socket.leave(`stream-${streamId}`);
    io.to(`stream-${streamId}`).emit('viewerLeft', socket.id);
  });

  socket.on('streamData', (data) => {
    const { streamId, streamData } = data;
    socket.to(`stream-${streamId}`).emit('streamData', streamData);
  });

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

// Follow associations
User.hasMany(Follow, { as: 'followers', foreignKey: 'followingId' });
User.hasMany(Follow, { as: 'following', foreignKey: 'followerId' });

/*sequelize.sync({alter: true}).then(() => {
  console.log('Database synced');
}).catch(err => console.log('DB sync error:', err));*/

// DB connection test only
sequelize.authenticate()
  .then(() => {
    console.log('✅ Database connected');
    // Run migrations
    const migration = require('./migrations/add-password-reset');
    const updateNotificationLinks = require('./migrations/update-notification-links');
    const { Sequelize } = require('sequelize');
    return migration.up(sequelize.getQueryInterface(), Sequelize)
      .then(() => updateNotificationLinks());
  })
  .catch(err => console.error('❌ Database connection error:', err));


server.listen(PORT, () => {
  const proto = (fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) ? 'https' : 'http';
  console.log(`Server running on ${proto}://localhost:${PORT}`);
});