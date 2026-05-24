#!/usr/bin/env node
/**
 * Vendos youtubeChannelId direkt në DB (kur nuk ke fjalëkalim API).
 *
 *   DATABASE_URL=postgresql://... \
 *   node scripts/set-youtube-by-email.js user@example.com UCflsCrcGKQ85RYdNM5oW27w
 */

require('dotenv').config();
const { normalizeYoutubeChannelId } = require('../utils/youtubeChannel');

async function main() {
  const email = process.argv[2] || process.env.TARGET_EMAIL;
  const rawChannel = process.argv[3] || process.env.YOUTUBE_CHANNEL_ID;

  if (!email || !rawChannel) {
    console.error('Usage: node scripts/set-youtube-by-email.js <email> <UC...|channel-url>');
    process.exit(1);
  }

  const channelId = normalizeYoutubeChannelId(rawChannel);
  if (!channelId) {
    console.error('Invalid YouTube channel ID');
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const sequelize = require('../config/database');
  const User = require('../models/User');
  const Profile = require('../models/Profile');

  await sequelize.authenticate();

  const user = await User.findOne({ where: { email: String(email).trim().toLowerCase() } });
  if (!user) {
    console.error('User not found:', email);
    process.exit(1);
  }

  let profile = await Profile.findOne({ where: { userId: user.id } });
  if (!profile) {
    profile = await Profile.create({ userId: user.id, youtubeChannelId: channelId });
  } else {
    profile.youtubeChannelId = channelId;
    await profile.save();
  }

  console.log('OK');
  console.log('  user:', user.id, user.email);
  console.log('  youtubeChannelId:', profile.youtubeChannelId);
  await sequelize.close();
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
