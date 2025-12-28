const sequelize = require('../config/database');

async function updateNotificationLinks() {
  try {
    console.log('🔄 Updating notification links...');
    
    // Update all notifications with old /posts/:id links to new /feed?post=:id format
    await sequelize.query(`
      UPDATE "Notifications" 
      SET "link" = REPLACE("link", '/posts/', '/feed?post=')
      WHERE "link" LIKE '/posts/%'
    `);
    
    console.log('✅ Notification links updated successfully');
  } catch (error) {
    console.error('❌ Update notification links error:', error.message);
  }
}

module.exports = updateNotificationLinks;
