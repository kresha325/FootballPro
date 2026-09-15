const VideoCall = require('../models/VideoCall');
const ScheduledCall = require('../models/ScheduledCall');
const User = require('../models/User');
const { sendNotification, createNotification } = require('./notifications');
const { Op } = require('sequelize');
const { Conversation, ConversationMember } = require('../models/Conversation');
const Message = require('../models/Message');
const sequelize = require('../config/database');
const { QueryTypes } = require('sequelize');

async function findOrCreateDirectConversationId(userA, userB) {
  const sql = `
    SELECT cm."conversationId"
    FROM "ConversationMembers" cm
    INNER JOIN "Conversations" c ON c.id = cm."conversationId"
    WHERE cm."userId" IN (:a, :b)
      AND (c."isGroup" = false OR c."isGroup" IS NULL)
    GROUP BY cm."conversationId"
    HAVING COUNT(DISTINCT cm."userId") = 2
    LIMIT 1
  `;
  const rows = await sequelize.query(sql, {
    replacements: { a: userA, b: userB },
    type: QueryTypes.SELECT,
  });
  let conversationId =
    rows?.[0]?.conversationId || rows?.[0]?.conversationid || rows?.[0]?.conversation_id || null;

  if (conversationId) return conversationId;

  const t = await sequelize.transaction();
  try {
    const newConv = await Conversation.create({ isGroup: false }, { transaction: t });
    await ConversationMember.bulkCreate(
      [
        { conversationId: newConv.id, userId: userA },
        { conversationId: newConv.id, userId: userB },
      ],
      { transaction: t }
    );
    await t.commit();
    return newConv.id;
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

function formatCallDuration(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m <= 0) return `${r}s`;
  return `${m}:${String(r).padStart(2, '0')}`;
}

async function emitCallChatMessage(payload) {
  try {
    const { getIo } = require('../socket');
    const io = getIo();
    if (!io || !payload?.conversationId) return;
    io.to(`conversation-${payload.conversationId}`).emit('newMessage', payload);
    const members = await ConversationMember.findAll({
      where: { conversationId: payload.conversationId },
      attributes: ['userId'],
    });
    members.forEach((m) => {
      if (m.userId != null) io.to(String(m.userId)).emit('newMessage', payload);
    });
  } catch (err) {
    console.warn('Emit call chat message failed:', err?.message || err);
  }
}

/**
 * Persist a call system bubble into the 1:1 chat (visible to both users).
 * event: missed | ended | declined | cancelled
 */
async function persistCallChatMessage({ callerId, receiverId, senderId, event, duration, callId }) {
  if (!callerId || !receiverId || !senderId) return null;
  try {
    const conversationId = await findOrCreateDirectConversationId(callerId, receiverId);
    let content = '📞 Thirrje';
    if (event === 'missed') content = '📞 Thirrje e humbur';
    else if (event === 'declined') content = '📞 Thirrja u refuzua';
    else if (event === 'cancelled') content = '📞 Thirrja u anulua';
    else if (event === 'ended') {
      content = duration > 0
        ? `📞 Thirrja përfundoi · ${formatCallDuration(duration)}`
        : '📞 Thirrja përfundoi';
    }

    const callMessage = await Message.create({
      conversationId,
      senderId,
      content,
      type: 'call',
    });
    await Conversation.update({ lastMessageAt: new Date() }, { where: { id: conversationId } });

    const sender = await User.findByPk(senderId, {
      attributes: ['id', 'firstName', 'lastName', 'verified'],
    });
    const payload = {
      ...callMessage.toJSON(),
      sender: sender
        ? {
            id: sender.id,
            firstName: sender.firstName,
            lastName: sender.lastName,
            verified: sender.verified,
          }
        : undefined,
      callEvent: event,
      callId,
    };
    await emitCallChatMessage(payload);
    return callMessage;
  } catch (err) {
    console.warn('Failed to persist call chat message:', err?.message || err);
    return null;
  }
}

// Create a video call
exports.createVideoCall = async (req, res) => {
  try {
    const { participantId, scheduledCallId } = req.body;

    // If there's already an active call between these users, return it instead of creating duplicate
    const existing = await VideoCall.findOne({
      where: {
        callerId: req.user.id,
        receiverId: participantId,
        status: { [Op.in]: ['ringing', 'connected'] },
      },
    });

    if (existing) {
      return res.json(existing);
    }

    const videoCall = await VideoCall.create({
      callerId: req.user.id,
      receiverId: participantId,
      scheduledCallId,
      status: 'ringing',
      startTime: new Date(),
    });

    console.log('✅ VideoCall created:', videoCall.id, { callerId: videoCall.callerId, receiverId: videoCall.receiverId });

    // Ensure 1:1 conversation exists so the missed/ended bubble can land later.
    findOrCreateDirectConversationId(req.user.id, participantId).catch((e) => {
      console.warn('Ensure conversation for call failed:', e?.message || e);
    });

    // Notify participant
    await sendNotification(
      participantId, 
      'Incoming Call', 
      `${req.user.firstName} ${req.user.lastName} is calling you`, 
      { type: 'call', callId: videoCall.id }
    );

    res.json(videoCall);
  } catch (error) {
    console.error('Create video call error:', error);
    res.status(500).json({ msg: 'Server error', error: error.message });
  }
};

exports.startCall = async (req, res) => {
  const { receiverId } = req.body;
  try {
    // Avoid duplicate calls
    const existing = await VideoCall.findOne({
      where: {
        callerId: req.user.id,
        receiverId,
        status: { [Op.in]: ['ringing', 'connected'] },
      },
    });

    if (existing) {
      // notify and return existing
      await sendNotification(receiverId, 'Incoming Call', `You have an incoming call from ${req.user.firstName}`, { type: 'call', callId: existing.id });
      console.log('↩️ startCall returning existing call:', existing.id);
      return res.json(existing);
    }

    const call = await VideoCall.create({
      callerId: req.user.id,
      receiverId,
      status: 'ringing',
      startTime: new Date(),
    });
    console.log('✅ startCall created VideoCall:', call.id, { callerId: call.callerId, receiverId: call.receiverId });
    // Notify receiver
    await sendNotification(receiverId, 'Incoming Call', `You have an incoming call from ${req.user.firstName}`, { type: 'call', callId: call.id });
    res.json(call);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.endCall = async (req, res) => {
  const { callId } = req.params;
  try {
    const call = await VideoCall.findByPk(callId);
    if (!call) return res.status(404).json({ msg: 'Call not found' });
    const uid = Number(req.user.id);
    if (uid !== Number(call.callerId) && uid !== Number(call.receiverId)) {
      return res.status(403).json({ msg: 'Nuk je pjesëmarrës i kësaj thirrjeje' });
    }
    if (call) {
      const callerUser = await User.findByPk(req.user.id);
      const callerName = callerUser
        ? `${callerUser.firstName || ''} ${callerUser.lastName || ''}`.trim()
        : 'Someone';
      const wasRinging = call.status === 'ringing';
      call.status = 'ended';
      call.endTime = new Date();
      call.duration = Math.floor((new Date() - call.startTime) / 1000);
      await call.save();

      const event =
        wasRinging && Number(req.user.id) === Number(call.callerId)
          ? 'missed'
          : wasRinging
            ? 'cancelled'
            : 'ended';
      await persistCallChatMessage({
        callerId: call.callerId,
        receiverId: call.receiverId,
        senderId: req.user.id,
        event,
        duration: call.duration,
        callId: call.id,
      });

      if (wasRinging && req.user.id === call.callerId && call.receiverId) {
        await createNotification({
          userId: call.receiverId,
          actorId: req.user.id,
          type: 'system',
          title: 'Missed Call',
          message: `${callerName} tried to call you`,
          link: '/messaging',
          entityType: 'call',
          entityId: call.id,
          metadata: { type: 'missed_call', callId: call.id },
          skipPush: true,
        });
        await sendNotification(
          call.receiverId,
          'Missed Call',
          `${callerName} tried to call you`,
          { type: 'missed_call', callId: call.id }
        );
      }
    }
    res.json({ msg: 'Call ended', call });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// Get active call
exports.getActiveCall = async (req, res) => {
  try {
    const activeCall = await VideoCall.findOne({
      where: {
        [Op.or]: [
          { callerId: req.user.id },
          { receiverId: req.user.id },
        ],
        status: { [Op.in]: ['ringing', 'connected'] },
      },
      include: [
        { model: User, as: 'caller', attributes: ['id', 'firstName', 'lastName'] },
        { model: User, as: 'receiver', attributes: ['id', 'firstName', 'lastName'] },
      ],
      order: [['createdAt', 'DESC']],
    });

    res.json(activeCall);
  } catch (error) {
    console.error('Get active call error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Update call status
exports.updateCallStatus = async (req, res) => {
  try {
    const { callId } = req.params;
    const { status } = req.body;

    const videoCall = await VideoCall.findByPk(callId);
    if (!videoCall) {
      return res.status(404).json({ msg: 'Call not found' });
    }
    const uid = Number(req.user.id);
    if (uid !== Number(videoCall.callerId) && uid !== Number(videoCall.receiverId)) {
      return res.status(403).json({ msg: 'Nuk je pjesëmarrës i kësaj thirrjeje' });
    }

    const callerUser = await User.findByPk(req.user.id);
    const callerName = callerUser
      ? `${callerUser.firstName || ''} ${callerUser.lastName || ''}`.trim()
      : 'Someone';
    const prevStatus = videoCall.status;
    videoCall.status = status;
    if (status === 'ended' || status === 'declined') {
      videoCall.endTime = new Date();
      videoCall.duration = Math.floor((new Date() - videoCall.startTime) / 1000);
    }

    await videoCall.save();

    if (status === 'ended' || status === 'declined') {
      const event =
        status === 'declined'
          ? 'declined'
          : prevStatus === 'ringing' && Number(req.user.id) === Number(videoCall.callerId)
            ? 'missed'
            : prevStatus === 'ringing'
              ? 'cancelled'
              : 'ended';
      await persistCallChatMessage({
        callerId: videoCall.callerId,
        receiverId: videoCall.receiverId,
        senderId: req.user.id,
        event,
        duration: videoCall.duration,
        callId: videoCall.id,
      });
    }

    if (prevStatus === 'ringing' && status === 'ended' && req.user.id === videoCall.callerId) {
      await createNotification({
        userId: videoCall.receiverId,
        actorId: req.user.id,
        type: 'system',
        title: 'Missed Call',
        message: `${callerName} tried to call you`,
        link: '/messaging',
        entityType: 'call',
        entityId: videoCall.id,
        metadata: { type: 'missed_call', callId: videoCall.id },
        skipPush: true,
      });
      await sendNotification(
        videoCall.receiverId,
        'Missed Call',
        `${callerName} tried to call you`,
        { type: 'missed_call', callId: videoCall.id }
      );
    }
    res.json(videoCall);
  } catch (error) {
    console.error('Update call status error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Get call history
exports.getCallHistory = async (req, res) => {
  try {
    const calls = await VideoCall.findAll({
      where: {
        [Op.or]: [
          { callerId: req.user.id },
          { receiverId: req.user.id },
        ],
      },
      include: [
        { model: User, as: 'caller', attributes: ['id', 'firstName', 'lastName'] },
        { model: User, as: 'receiver', attributes: ['id', 'firstName', 'lastName'] },
      ],
      order: [['createdAt', 'DESC']],
      limit: 50,
    });

    res.json(calls);
  } catch (error) {
    console.error('Get call history error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.scheduleCall = async (req, res) => {
  const { receiverId, scheduledTime } = req.body;
  try {
    const scheduledCall = await ScheduledCall.create({
      callerId: req.user.id,
      receiverId,
      scheduledTime,
    });
    // Notify receiver
    await sendNotification(receiverId, 'Scheduled Call', `You have a scheduled call with ${req.user.firstName} at ${scheduledTime}`, { type: 'scheduled_call', callId: scheduledCall.id });
    res.json(scheduledCall);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.getScheduledCalls = async (req, res) => {
  try {
    const calls = await ScheduledCall.findAll({
      where: {
        [require('sequelize').Op.or]: [
          { callerId: req.user.id },
          { receiverId: req.user.id },
        ],
      },
      include: [
        { model: require('../models/User'), as: 'caller', attributes: ['id', 'firstName', 'lastName'] },
        { model: require('../models/User'), as: 'receiver', attributes: ['id', 'firstName', 'lastName'] },
      ],
      order: [['scheduledTime', 'ASC']],
    });
    res.json(calls);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};