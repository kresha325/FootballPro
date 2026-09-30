'use strict';

const { QueryTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('../models/User');
const Profile = require('../models/Profile');
const { Conversation, ConversationMember } = require('../models/Conversation');
const Message = require('../models/Message');
const { hasTier } = require('../utils/subscriptionAccess');
const { resolveSupportTeamUser } = require('../utils/supportTeam');
const { toAbsoluteUploadsUrl } = require('../utils/url');

function shapeMember(m, req) {
  const plain = typeof m.toJSON === 'function' ? m.toJSON() : m;
  const photo = plain.Profile?.profilePhoto || plain.profilePhoto || null;
  return {
    id: plain.id,
    firstName: plain.firstName,
    lastName: plain.lastName,
    verified: plain.verified,
    profilePhoto: photo && req ? toAbsoluteUploadsUrl(req, photo) : photo,
    Profile: plain.Profile
      ? {
          ...plain.Profile,
          profilePhoto:
            plain.Profile.profilePhoto && req
              ? toAbsoluteUploadsUrl(req, plain.Profile.profilePhoto)
              : plain.Profile.profilePhoto,
        }
      : plain.Profile,
  };
}

async function findOrCreateDm(userA, userB) {
  const sql = `SELECT "conversationId" FROM "ConversationMembers" WHERE "userId" IN (:a,:b) GROUP BY "conversationId" HAVING COUNT(DISTINCT "userId") = 2 LIMIT 1`;
  const matches = await sequelize.query(sql, {
    replacements: { a: userA, b: userB },
    type: QueryTypes.SELECT,
  });

  if (matches?.length) {
    const conversationId =
      matches[0].conversationId || matches[0].conversationid || matches[0].conversation_id;
    const existing = await Conversation.findByPk(conversationId, {
      include: [
        { model: ConversationMember, as: 'memberships', attributes: ['userId'] },
        {
          model: User,
          as: 'members',
          attributes: ['id', 'firstName', 'lastName', 'verified'],
          include: [{ model: Profile, attributes: ['profilePhoto'], required: false }],
          through: { attributes: [] },
        },
      ],
    });
    if (existing && !existing.isGroup) {
      return { conversation: existing, created: false };
    }
  }

  const t = await sequelize.transaction();
  try {
    const conversation = await Conversation.create({ isGroup: false }, { transaction: t });
    await ConversationMember.bulkCreate(
      [
        { conversationId: conversation.id, userId: userA },
        { conversationId: conversation.id, userId: userB },
      ],
      { transaction: t }
    );
    await t.commit();
    const full = await Conversation.findByPk(conversation.id, {
      include: [
        { model: ConversationMember, as: 'memberships', attributes: ['userId'] },
        {
          model: User,
          as: 'members',
          attributes: ['id', 'firstName', 'lastName', 'verified'],
          include: [{ model: Profile, attributes: ['profilePhoto'], required: false }],
          through: { attributes: [] },
        },
      ],
    });
    return { conversation: full, created: true };
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

/**
 * Pro priority support: open DM with X Talenti team + seed intro message.
 */
exports.openPriorityChat = async (req, res) => {
  try {
    if (!hasTier(req.user, 'pro')) {
      return res.status(403).json({
        msg: 'Suporti prioritar në chat kërkon planin Pro.',
        code: 'PLAN_REQUIRED',
        requiredTier: 'pro',
      });
    }

    const team = await resolveSupportTeamUser();
    if (!team) {
      return res.status(503).json({
        msg: 'X Talenti Team nuk është konfiguruar ende. Përdor email support@xtalenti.com.',
        code: 'SUPPORT_TEAM_MISSING',
        mailto: 'support@xtalenti.com',
      });
    }

    if (Number(team.id) === Number(req.user.id)) {
      return res.status(400).json({ msg: 'Nuk mund të hapësh chat support me veten.' });
    }

    const { conversation, created } = await findOrCreateDm(req.user.id, team.id);
    const displayName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ').trim();

    const intro = [
      '[Pro Priority] Kërkesë mbështetjeje',
      '',
      `User ID: ${req.user.id}`,
      `Emri: ${displayName || '—'}`,
      `Email: ${req.user.email || '—'}`,
      '',
      'Problemi / pyetja:',
      '',
    ].join('\n');

    // Seed intro only when conversation is new or user asked with force=1
    const force = String(req.query.force || req.body?.force || '') === '1';
    let seeded = false;
    if (created || force) {
      await Message.create({
        conversationId: conversation.id,
        senderId: req.user.id,
        receiverId: team.id,
        content: intro,
        type: 'text',
      });
      seeded = true;
    }

    const data = conversation.toJSON();
    if (Array.isArray(data.members)) {
      data.members = data.members.map((m) => shapeMember(m, req));
    }

    res.json({
      conversation: data,
      conversationId: conversation.id,
      teamUserId: team.id,
      teamName: `${team.firstName || 'X Talenti'} ${team.lastName || 'Team'}`.trim(),
      created,
      seeded,
    });
  } catch (err) {
    console.error('openPriorityChat:', err);
    res.status(500).json({ msg: 'Gabim në hapjen e chat-it të supportit', error: err.message });
  }
};
