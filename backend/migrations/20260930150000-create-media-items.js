'use strict';

/** YouTube VOD media metadata (no Cloudinary / no video file storage). */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const normalized = tables.map((t) => String(t).toLowerCase());

    if (!normalized.includes('mediaitems')) {
      await queryInterface.createTable('MediaItems', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        youtubeVideoId: {
          type: Sequelize.STRING(32),
          allowNull: false,
        },
        youtubeUrl: {
          type: Sequelize.STRING(512),
          allowNull: false,
        },
        title: {
          type: Sequelize.STRING(255),
          allowNull: false,
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        thumbnailUrl: {
          type: Sequelize.STRING(512),
          allowNull: true,
        },
        mediaType: {
          type: Sequelize.STRING(32),
          allowNull: false,
          defaultValue: 'youtube',
        },
        category: {
          type: Sequelize.STRING(64),
          allowNull: false,
          defaultValue: 'other',
        },
        playerId: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'Users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        clubId: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'Users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        matchId: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'Matches', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        teamId: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'Users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        tournamentId: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'Tournaments', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        season: {
          type: Sequelize.STRING(64),
          allowNull: true,
        },
        uploadedBy: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'Users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        visibility: {
          type: Sequelize.STRING(32),
          allowNull: false,
          defaultValue: 'public',
        },
        durationSeconds: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        publishedAt: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });

      await queryInterface.addIndex('MediaItems', ['youtubeVideoId']);
      await queryInterface.addIndex('MediaItems', ['playerId']);
      await queryInterface.addIndex('MediaItems', ['clubId']);
      await queryInterface.addIndex('MediaItems', ['matchId']);
      await queryInterface.addIndex('MediaItems', ['teamId']);
      await queryInterface.addIndex('MediaItems', ['category']);
      await queryInterface.addIndex('MediaItems', ['visibility']);
      await queryInterface.addIndex('MediaItems', ['createdAt']);
      await queryInterface.addIndex('MediaItems', ['youtubeVideoId', 'uploadedBy'], {
        unique: true,
        name: 'media_items_youtube_uploader_unique',
      });
    }

    if (!normalized.includes('mediaevents')) {
      await queryInterface.createTable('MediaEvents', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        mediaId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'MediaItems', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        userId: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'Users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        eventType: {
          type: Sequelize.STRING(64),
          allowNull: false,
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });

      await queryInterface.addIndex('MediaEvents', ['mediaId', 'eventType', 'createdAt'], {
        name: 'media_events_media_type_created',
      });
    }
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const normalized = tables.map((t) => String(t).toLowerCase());
    if (normalized.includes('mediaevents')) {
      await queryInterface.dropTable('MediaEvents');
    }
    if (normalized.includes('mediaitems')) {
      await queryInterface.dropTable('MediaItems');
    }
  },
};
