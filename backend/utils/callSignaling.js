'use strict';

const WINDOWS = new Map();
const LIMITS = {
  'call:offer': 8,
  'call:answer': 16,
  'call:ice-candidate': 120,
  'call:reject': 16,
  'call:end': 24,
};
const WINDOW_MS = 60_000;
const { CHANNELS, authorizeMinorDirectContact } = require('./minorCommunicationPolicy');

function payloadSize(value) {
  try { return Buffer.byteLength(JSON.stringify(value ?? null)); } catch { return Infinity; }
}

function createCallSignalingHandlers({ io, socket, authenticatedUserId, VideoCall, VideoCallHistory, User, ClubMember, ClubStaff, GuardianConsent, isEitherBlocked, isUserOnline, now = Date.now }) {
  const actorId = Number(authenticatedUserId);
  const emitFailure = (reason = 'User not available') => socket.emit('call:failed', { reason });

  function rateAllowed(event) {
    const timestamp = now();
    if (WINDOWS.size > 5_000) {
      for (const [key, times] of WINDOWS) {
        if (!times.some((time) => timestamp - time < WINDOW_MS)) WINDOWS.delete(key);
      }
    }
    const key = `${actorId}:${event}`;
    const bucket = WINDOWS.get(key) || [];
    const recent = bucket.filter((time) => timestamp - time < WINDOW_MS);
    if (recent.length >= LIMITS[event]) {
      WINDOWS.set(key, recent);
      emitFailure('Too many call events');
      return false;
    }
    recent.push(timestamp);
    WINDOWS.set(key, recent);
    return true;
  }

  async function resolveCall(data, event) {
    if (!Number.isSafeInteger(actorId) || actorId < 1 || !rateAllowed(event)) return null;
    if (payloadSize(data) > (event === 'call:ice-candidate' ? 16_384 : 262_144)) {
      emitFailure('Invalid call payload');
      return null;
    }
    const callId = Number(data?.callId);
    if (!Number.isSafeInteger(callId) || callId < 1) {
      emitFailure('Call not found');
      return null;
    }
    let call;
    try {
      call = await VideoCall.findByPk(callId);
    } catch {
      emitFailure('Call unavailable');
      return null;
    }
    if (!call || !['ringing', 'connected'].includes(String(call.status).toLowerCase())) {
      emitFailure('Call not found');
      return null;
    }
    const callerId = Number(call.callerId);
    const receiverId = Number(call.receiverId);
    if (actorId !== callerId && actorId !== receiverId) {
      emitFailure('Unauthorized');
      return null;
    }
    const otherId = actorId === callerId ? receiverId : callerId;
    if (data?.to != null && Number(data.to) !== otherId) {
      emitFailure('Unauthorized');
      return null;
    }
    if (event === 'call:offer' && actorId !== callerId) {
      emitFailure('Unauthorized');
      return null;
    }
    if ((event === 'call:answer' || event === 'call:reject') && (actorId !== receiverId || call.status !== 'ringing')) {
      emitFailure('Unauthorized');
      return null;
    }
    if (!['call:end', 'call:reject'].includes(event)) {
      try {
        if (await isEitherBlocked(actorId, otherId)) {
          emitFailure();
          return null;
        }
        const communication = await authorizeMinorDirectContact({
          actorId,
          targetId: otherId,
          channel: CHANNELS.VIDEO_CALL,
          User,
          ClubMember,
          ClubStaff,
          GuardianConsent,
        });
        if (!communication.allowed) {
          emitFailure('Guardian approval or an active club assignment is required');
          return null;
        }
      } catch {
        emitFailure('Call authorization unavailable');
        return null;
      }
    }
    return { call, otherId };
  }

  socket.on('call:offer', async (data = {}) => {
    const resolved = await resolveCall(data, 'call:offer');
    if (!resolved) return;
    const offer = data.offer;
    if (!offer || !['object', 'string'].includes(typeof offer)) return emitFailure('Invalid call payload');
    const caller = await User.findByPk(actorId, { attributes: ['firstName', 'lastName'] }).catch(() => null);
    if (isUserOnline && !isUserOnline(resolved.otherId)) {
      emitFailure();
      return;
    }
    io.to(String(resolved.otherId)).emit('call:incoming', {
      from: actorId,
      callerName: caller ? `${caller.firstName || ''} ${caller.lastName || ''}`.trim() : '',
      offer,
      callId: resolved.call.id,
      audioOnly: Boolean(data.audioOnly),
    });
  });

  socket.on('call:answer', async (data = {}) => {
    const resolved = await resolveCall(data, 'call:answer');
    if (!resolved || !data.answer || !['object', 'string'].includes(typeof data.answer)) return;
    resolved.call.status = 'connected';
    resolved.call.connectedAt = new Date(now());
    await resolved.call.save();
    io.to(String(resolved.otherId)).emit('call:answered', { from: actorId, answer: data.answer, callId: resolved.call.id });
    io.to(String(resolved.call.callerId)).emit('call:connected', { callId: resolved.call.id });
    io.to(String(resolved.call.receiverId)).emit('call:connected', { callId: resolved.call.id });
  });

  socket.on('call:ice-candidate', async (data = {}) => {
    const resolved = await resolveCall(data, 'call:ice-candidate');
    if (!resolved || !data.candidate || typeof data.candidate !== 'object') return;
    io.to(String(resolved.otherId)).emit('call:ice-candidate', { from: actorId, candidate: data.candidate, callId: resolved.call.id });
  });

  socket.on('call:reject', async (data = {}) => {
    const resolved = await resolveCall(data, 'call:reject');
    if (resolved) io.to(String(resolved.otherId)).emit('call:rejected', { from: actorId, callId: resolved.call.id });
  });

  socket.on('call:end', async (data = {}) => {
    // Preserve the legacy group-call leave event, but only for a room this
    // authenticated socket actually joined and is recorded as a participant.
    if (data.roomId && socket.rooms?.has(String(data.roomId))) {
      if (!rateAllowed('call:end')) return;
      const roomCall = await VideoCallHistory.findOne({ where: { roomId: String(data.roomId), endedAt: null } }).catch(() => null);
      const participants = Array.isArray(roomCall?.participants) ? roomCall.participants.map(Number) : [];
      if (roomCall && participants.includes(actorId)) {
        io.to(String(data.roomId)).emit('call:user-left', { userId: actorId });
        const remaining = participants.filter((id) => id !== actorId);
        roomCall.participants = remaining;
        if (remaining.length < 2) roomCall.endedAt = new Date(now());
        await roomCall.save();
        socket.leave(String(data.roomId));
        return;
      }
      emitFailure('Unauthorized');
      return;
    }
    const resolved = await resolveCall(data, 'call:end');
    if (resolved) io.to(String(resolved.otherId)).emit('call:ended', { from: actorId, callId: resolved.call.id });
  });
}

function resetRateLimitsForTests() { WINDOWS.clear(); }

module.exports = { createCallSignalingHandlers, resetRateLimitsForTests };
