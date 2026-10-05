'use strict';

async function describeSafe(queryInterface, table) {
  try {
    return await queryInterface.describeTable(table);
  } catch (_err) {
    return null;
  }
}

async function ensureColumn(queryInterface, table, column, spec) {
  const desc = await describeSafe(queryInterface, table);
  if (!desc || desc[column]) return;
  await queryInterface.addColumn(table, column, spec);
}

async function ensureIndex(queryInterface, table, fields, name) {
  try {
    await queryInterface.addIndex(table, fields, { name });
  } catch (_err) {
    /* index already exists */
  }
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await ensureColumn(queryInterface, 'Profiles', 'privacy', {
      type: Sequelize.JSON,
      allowNull: true,
    });

    await ensureColumn(queryInterface, 'Galleries', 'visibility', {
      type: Sequelize.STRING(16),
      allowNull: false,
      defaultValue: 'public',
    });
    await ensureColumn(queryInterface, 'Galleries', 'featured', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await ensureColumn(queryInterface, 'Galleries', 'sortOrder', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    await ensureColumn(queryInterface, 'MediaItems', 'featured', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await ensureColumn(queryInterface, 'MediaItems', 'sortOrder', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    await ensureIndex(queryInterface, 'ProfileViews', ['viewerId', 'profileId', 'viewedAt'], 'profile_views_viewer_profile_recent');
    await ensureIndex(queryInterface, 'Galleries', ['userId', 'featured'], 'galleries_user_featured');
    await ensureIndex(queryInterface, 'MediaItems', ['playerId', 'featured'], 'media_items_player_featured');
  },

  async down(queryInterface) {
    const drop = async (table, column) => {
      const desc = await describeSafe(queryInterface, table);
      if (desc && desc[column]) await queryInterface.removeColumn(table, column);
    };
    await drop('Profiles', 'privacy');
    await drop('Galleries', 'visibility');
    await drop('Galleries', 'featured');
    await drop('Galleries', 'sortOrder');
    await drop('MediaItems', 'featured');
    await drop('MediaItems', 'sortOrder');
  },
};
