// Script to reset all data and uploads folder
const fs = require('fs');
const path = require('path');
const { sequelize, User, Post, Comment, Like, Gallery, PostAnalytics, Notification, Ad, Sponsor, Follow, Profile } = require('../models');
const EngagementMetrics = require('../models/EngagementMetrics');
const Message = require('../models/Message');
const Tournament = require('../models').Tournament;

const uploadsDir = path.join(__dirname, '../uploads');

function deleteAllUploads() {
  if (fs.existsSync(uploadsDir)) {
    fs.rmSync(uploadsDir, { recursive: true, force: true });
    fs.mkdirSync(uploadsDir); // recreate empty uploads folder
    console.log('✅ All files and folders deleted from uploads folder.');
  } else {
    console.log('ℹ️ uploads folder does not exist.');
  }
}

async function resetDatabase() {
  try {
    // Delete dependent tables first
    await Notification.destroy({ where: {} });
    await Ad.destroy({ where: {} });
    await Sponsor.destroy({ where: {} });
    await Follow.destroy({ where: {} });
    await Profile.destroy({ where: {} });
    await EngagementMetrics.destroy({ where: {} });
    await Message.destroy({ where: {} });
    await Tournament.destroy({ where: {} });
    await Comment.destroy({ where: {} });
    await Like.destroy({ where: {} });
    await Gallery.destroy({ where: {} });
    await PostAnalytics.destroy({ where: {} });
    await Post.destroy({ where: {} });
    await User.destroy({ where: {} });
    console.log('✅ All database tables reset.');
  } catch (err) {
    console.error('❌ Error resetting database:', err);
  }
}

(async () => {
  await resetDatabase();
  deleteAllUploads();
  console.log('✅ System fully reset. You can now register new users and test.');
  process.exit(0);
})();
