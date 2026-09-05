const VideoCall = require('../models/VideoCall');
const Stream = require('../models/Stream');
const { ConversationMember } = require('../models/Conversation');

const CALL_ROOM = /^call-(\d+)$/i;
const STREAM_ROOM = /^stream-(\d+)$/i;
const GROUP_ROOM = /^group-(\d+)$/i;

/**
 * Authorize LiveKit room access for an authenticated user.
 * @returns {{ ok: true, role: string } | { ok: false, status: number, msg: string }}
 */
async function authorizeLiveKitRoom(userId, roomName, { canPublish = false } = {}) {
  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid <= 0) {
    return { ok: false, status: 401, msg: 'Autentikimi është i detyrueshëm' };
  }
  if (!roomName || typeof roomName !== 'string') {
    return { ok: false, status: 400, msg: 'roomName është i detyrueshëm' };
  }

  const callMatch = CALL_ROOM.exec(roomName.trim());
  if (callMatch) {
    const call = await VideoCall.findByPk(callMatch[1]);
    if (!call) {
      return { ok: false, status: 404, msg: 'Thirrja nuk u gjet' };
    }
    const allowed =
      Number(call.callerId) === uid || Number(call.receiverId) === uid;
    if (!allowed) {
      return { ok: false, status: 403, msg: 'Nuk je pjesëmarrës i kësaj thirrjeje' };
    }
    return { ok: true, role: Number(call.callerId) === uid ? 'caller' : 'receiver' };
  }

  const streamMatch = STREAM_ROOM.exec(roomName.trim());
  if (streamMatch) {
    const stream = await Stream.findByPk(streamMatch[1]);
    if (!stream) {
      return { ok: false, status: 404, msg: 'Transmetimi nuk u gjet' };
    }
    const isOwner = Number(stream.streamerId) === uid;
    if (canPublish && !isOwner) {
      return { ok: false, status: 403, msg: 'Vetëm streamer-i mund të publikoje në këtë dhomë' };
    }
    return { ok: true, role: isOwner ? 'streamer' : 'viewer' };
  }

  const groupMatch = GROUP_ROOM.exec(roomName.trim());
  if (groupMatch) {
    const member = await ConversationMember.findOne({
      where: { conversationId: groupMatch[1], userId: uid },
      attributes: ['id'],
    });
    if (!member) {
      return { ok: false, status: 403, msg: 'Nuk je anëtar i kësaj bisede' };
    }
    return { ok: true, role: 'member' };
  }

  return {
    ok: false,
    status: 403,
    msg: 'Emri i dhomës nuk lejohet. Përdor call-{id}, stream-{id} ose group-{id}.',
  };
}

module.exports = {
  authorizeLiveKitRoom,
  CALL_ROOM,
  STREAM_ROOM,
  GROUP_ROOM,
};
