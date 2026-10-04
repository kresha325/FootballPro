'use strict';

/**
 * Messaging production gaps: reactions, delivery, forward flag, group owner, query indexes.
 * Idempotent so it can run on databases that already have some of these objects.
 */

async function tableExists(queryInterface, name) {
  const tables = await queryInterface.showAllTables();
  return tables.map((t) => String(t).toLowerCase()).includes(String(name).toLowerCase());
}

async function columnExists(queryInterface, table, column) {
  try {
    const desc = await queryInterface.describeTable(table);
    return !!desc[column];
  } catch (_e) {
    return false;
  }
}

async function indexNames(queryInterface, table) {
  try {
    const indexes = await queryInterface.showIndex(table);
    return new Set(indexes.map((idx) => String(idx.name || '').toLowerCase()));
  } catch (_e) {
    return new Set();
  }
}

async function addIndexIfMissing(queryInterface, table, fields, options) {
  const names = await indexNames(queryInterface, table);
  if (names.has(String(options.name).toLowerCase())) return;
  await queryInterface.addIndex(table, fields, options);
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    if (await tableExists(queryInterface, 'Messages')) {
      if (!(await columnExists(queryInterface, 'Messages', 'deliveredAt'))) {
        await queryInterface.addColumn('Messages', 'deliveredAt', {
          type: Sequelize.DATE,
          allowNull: true,
        });
      }
      if (!(await columnExists(queryInterface, 'Messages', 'forwarded'))) {
        await queryInterface.addColumn('Messages', 'forwarded', {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        });
      }
      await addIndexIfMissing(queryInterface, 'Messages', ['conversationId', 'createdAt'], {
        name: 'messages_conversation_created_idx',
      });
      await addIndexIfMissing(queryInterface, 'Messages', ['senderId'], {
        name: 'messages_sender_idx',
      });
      await addIndexIfMissing(queryInterface, 'Messages', ['replyToId'], {
        name: 'messages_reply_idx',
      });
    }

    if (await tableExists(queryInterface, 'Conversations')) {
      if (!(await columnExists(queryInterface, 'Conversations', 'ownerId'))) {
        await queryInterface.addColumn('Conversations', 'ownerId', {
          type: Sequelize.INTEGER,
          allowNull: true,
        });
      }
      await addIndexIfMissing(queryInterface, 'Conversations', ['lastMessageAt'], {
        name: 'conversations_last_message_idx',
      });
    }

    if (await tableExists(queryInterface, 'ConversationMembers')) {
      await addIndexIfMissing(queryInterface, 'ConversationMembers', ['userId'], {
        name: 'conversation_members_user_idx',
      });
      await addIndexIfMissing(queryInterface, 'ConversationMembers', ['conversationId', 'userId'], {
        name: 'conversation_members_conv_user_idx',
      });
      await addIndexIfMissing(queryInterface, 'ConversationMembers', ['conversationId', 'lastReadAt'], {
        name: 'conversation_members_read_idx',
      });
    }

    if (!(await tableExists(queryInterface, 'MessageReactions'))) {
      await queryInterface.createTable('MessageReactions', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        messageId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'Messages', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        userId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'Users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        emoji: { type: Sequelize.STRING(16), allowNull: false },
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
      await queryInterface.addIndex('MessageReactions', ['messageId', 'userId', 'emoji'], {
        name: 'message_reactions_unique_idx',
        unique: true,
      });
      await queryInterface.addIndex('MessageReactions', ['messageId'], {
        name: 'message_reactions_message_idx',
      });
    }
  },

  down: async (queryInterface) => {
    if (await tableExists(queryInterface, 'MessageReactions')) {
      await queryInterface.dropTable('MessageReactions');
    }
  },
};
