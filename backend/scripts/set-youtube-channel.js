#!/usr/bin/env node
/**
 * Vendos youtubeChannelId në profilin e një përdoruesi (p.sh. llogaria test).
 *
 *   API_URL=https://footballpro.onrender.com \
 *   TEST_EMAIL=you@example.com \
 *   TEST_PASSWORD=secret \
 *   YOUTUBE_CHANNEL_ID=UCxxxxxxxxxxxxxxxxxxxxxxxx \
 *   node scripts/set-youtube-channel.js
 *
 * YOUTUBE_CHANNEL_ID mund të jetë edhe link: https://www.youtube.com/channel/UC…
 */

const axios = require('axios');
const FormData = require('form-data');
const { normalizeYoutubeChannelId } = require('../utils/youtubeChannel');

const base = (process.env.API_URL || 'http://localhost:10000').replace(/\/$/, '');
const email = process.env.TEST_EMAIL;
const password = process.env.TEST_PASSWORD;
const rawChannel = process.env.YOUTUBE_CHANNEL_ID || process.argv[2];

async function main() {
  if (!email || !password) {
    console.error('Set TEST_EMAIL and TEST_PASSWORD');
    process.exit(1);
  }
  if (!rawChannel) {
    console.error('Set YOUTUBE_CHANNEL_ID or pass UC… as first argument');
    process.exit(1);
  }

  const channelId = normalizeYoutubeChannelId(rawChannel);
  if (!channelId) {
    console.error('Invalid YouTube channel ID. Use UC + 22 chars or youtube.com/channel/UC… link.');
    process.exit(1);
  }

  const login = await axios.post(`${base}/api/auth/login`, { email, password }, { validateStatus: () => true });
  const token = login.data?.token;
  if (!token) {
    console.error('Login failed:', login.status, login.data?.msg || login.data);
    process.exit(1);
  }

  const form = new FormData();
  form.append('youtubeChannelId', channelId);

  const update = await axios.put(`${base}/api/profiles/me`, form, {
    headers: { ...form.getHeaders(), Authorization: `Bearer ${token}` },
    validateStatus: () => true,
  });

  if (update.status !== 200) {
    console.error('Profile update failed:', update.status, update.data);
    process.exit(1);
  }

  const me = await axios.get(`${base}/api/profiles/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  console.log('OK — youtubeChannelId saved:', me.data?.youtubeChannelId || channelId);
  console.log('User:', email);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
