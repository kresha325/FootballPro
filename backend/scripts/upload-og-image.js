#!/usr/bin/env node
/**
 * One-shot: upload backend/public/share-card.jpg to Cloudinary as branding/xtalenti-share-card.
 * Usage (local or Render shell):
 *   node scripts/upload-og-image.js
 */
require('dotenv').config();
const { ensureOgImageOnCloudinary, brandOgImageUrl } = require('../utils/ogImage');

ensureOgImageOnCloudinary()
  .then((url) => {
    console.log('OG image URL:', url || brandOgImageUrl());
    process.exit(url ? 0 : 1);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
