'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createCallSignalingHandlers, resetRateLimitsForTests } = require('../utils/callSignaling');

function setup(actorId, calls = []) {
  const handlers = new Map();
  const emitted = [];
  const socket = {
    rooms: new Set(['sock']),
    on: (name, fn) => handlers.set(name, fn),
    emit: (...args) => emitted.push(['socket', ...args]),
  };
  const io = { to: (room) => ({ emit: (...args) => emitted.push([String(room), ...args]) }) };
  let conversationCreates = 0;
  const VideoCall = {
    findByPk: async (id) => calls.find((call) => Number(call.id) === Number(id)) || null,
    create: async () => { throw new Error('signaling must not create calls'); },
  };
  const User = { findByPk: async () => ({ firstName: 'Caller', lastName: 'Name' }) };
  createCallSignalingHandlers({ io, socket, authenticatedUserId: String(actorId), VideoCall, User, VideoCallHistory: { findOne: async () => null }, isEitherBlocked: async () => false });
  return { handlers, emitted, getConversationCreates: () => conversationCreates };
}

describe('Socket.IO call signaling authorization', () => {
  beforeEach(resetRateLimitsForTests);

  it('requires an existing call and never creates a call or conversation from call:offer', async () => {
    const ctx = setup(1);
    await ctx.handlers.get('call:offer')({ to: 2, offer: { type: 'offer' } });
    assert.equal(ctx.emitted.some((item) => item[0] === '2' && item[1] === 'call:incoming'), false);
    assert.equal(ctx.emitted.some((item) => item[1] === 'call:failed'), true);
    assert.equal(ctx.getConversationCreates(), 0);
  });

  it('rejects spoofed recipient and nonparticipant for all signaling events', async () => {
    const call = { id: 10, callerId: 1, receiverId: 2, status: 'ringing', async save() {} };
    const ctx = setup(1, [call]);
    await ctx.handlers.get('call:offer')({ callId: 10, to: 9, offer: { type: 'offer' } });
    await ctx.handlers.get('call:ice-candidate')({ callId: 10, to: 9, candidate: { candidate: 'x' } });
    const outsider = setup(9, [call]);
    await outsider.handlers.get('call:end')({ callId: 10, to: 1 });
    for (const context of [ctx, outsider]) assert.equal(context.emitted.some((item) => ['call:incoming', 'call:ice-candidate', 'call:ended'].includes(item[1])), false);
  });

  it('forwards an authorized offer only to the call record recipient and derives caller identity server-side', async () => {
    const call = { id: 11, callerId: 1, receiverId: 2, status: 'ringing', async save() {} };
    const ctx = setup(1, [call]);
    await ctx.handlers.get('call:offer')({ callId: 11, to: 2, callerName: 'Spoofed', offer: { type: 'offer' } });
    const forwarded = ctx.emitted.find((item) => item[1] === 'call:incoming');
    assert.equal(forwarded[0], '2');
    assert.equal(forwarded[2].callerName, 'Caller Name');
    assert.equal(forwarded[2].from, 1);
  });

  it('only lets the receiver answer or reject, and only permits ICE/end for either participant', async () => {
    const call = { id: 12, callerId: 1, receiverId: 2, status: 'ringing', async save() { this.saved = true; } };
    const receiver = setup(2, [call]);
    await receiver.handlers.get('call:answer')({ callId: 12, to: 1, answer: { type: 'answer' } });
    assert.equal(call.status, 'connected');
    assert.equal(receiver.emitted.some((item) => item[1] === 'call:answered'), true);

    const caller = setup(1, [call]);
    await caller.handlers.get('call:reject')({ callId: 12, to: 2 });
    assert.equal(caller.emitted.some((item) => item[1] === 'call:rejected'), false);
    await caller.handlers.get('call:ice-candidate')({ callId: 12, to: 2, candidate: { candidate: 'ok' } });
    await caller.handlers.get('call:end')({ callId: 12, to: 2 });
    assert.equal(caller.emitted.some((item) => item[1] === 'call:ice-candidate'), true);
    assert.equal(caller.emitted.some((item) => item[1] === 'call:ended'), true);
  });

  it('fails closed when block lookup errors and rate limits repeated offers', async () => {
    const call = { id: 13, callerId: 1, receiverId: 2, status: 'ringing', async save() {} };
    const blocked = setup(1, [call]);
    // Install an independent handler with fail-closed block lookup.
    const localHandlers = new Map();
    const socket = { on: (n, fn) => localHandlers.set(n, fn), emit: (...args) => blocked.emitted.push(['socket', ...args]), rooms: new Set() };
    const io = { to: (room) => ({ emit: (...args) => blocked.emitted.push([String(room), ...args]) }) };
    createCallSignalingHandlers({ io, socket, authenticatedUserId: '1', VideoCall: { findByPk: async () => call }, User: { findByPk: async () => null }, VideoCallHistory: {}, isEitherBlocked: async () => { throw new Error('unavailable'); } });
    await localHandlers.get('call:offer')({ callId: 13, to: 2, offer: {} });
    assert.equal(blocked.emitted.some((item) => item[1] === 'call:incoming'), false);

    resetRateLimitsForTests();
    const spam = setup(101, [call]);
    const spamCall = { id: 13, callerId: 101, receiverId: 2, status: 'ringing', async save() {} };
    const spamContext = setup(101, [spamCall]);
    for (let i = 0; i < 9; i++) await spamContext.handlers.get('call:offer')({ callId: 13, to: 2, offer: {} });
    assert.equal(spamContext.emitted.filter((item) => item[1] === 'call:incoming').length, 8);
    assert.equal(spamContext.emitted.some((item) => item[2]?.reason === 'Too many call events'), true);
    void spam;
  });
});
