module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Update all notifications with old /posts/:id links to new /feed?post=:id format
    await queryInterface.sequelize.query(`
      UPDATE "Notifications" 
      SET "link" = REPLACE("link", '/posts/', '/feed?post=')
      WHERE "link" LIKE '/posts/%'
    `);
  },
  down: async (queryInterface, Sequelize) => {
    // Revert links back to the old format if needed
    await queryInterface.sequelize.query(`
      UPDATE "Notifications" 
      SET "link" = REPLACE("link", '/feed?post=', '/posts/')
      WHERE "link" LIKE '/feed?post=%'
    `);
  }
};
