/**
 * Phase 3 smoke tests: order cart + messaging ACL (no DB).
 * Run: node --test tests/phase3-smoke.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeOrderCart } = require('../utils/orderCart');
const { requireConversationMember } = require('../utils/conversationAcl');

describe('normalizeOrderCart', () => {
  it('rejects empty cart', () => {
    const r = normalizeOrderCart([]);
    assert.equal(r.ok, false);
    assert.equal(r.status, 400);
  });

  it('rejects invalid productId', () => {
    const r = normalizeOrderCart([{ productId: 'x', quantity: 1 }]);
    assert.equal(r.ok, false);
    assert.equal(r.status, 400);
  });

  it('merges quantities and sorts product ids', () => {
    const r = normalizeOrderCart([
      { productId: 3, quantity: 2 },
      { productId: 1, quantity: 1 },
      { productId: 3, quantity: 1 },
    ]);
    assert.equal(r.ok, true);
    assert.deepEqual(r.sortedProductIds, [1, 3]);
    assert.equal(r.quantityByProductId[3], 3);
    assert.equal(r.quantityByProductId[1], 1);
  });
});

describe('requireConversationMember', () => {
  it('denies when unauthenticated', async () => {
    const r = await requireConversationMember(
      { findOne: async () => ({ id: 1 }) },
      { conversationId: 10, userId: null }
    );
    assert.equal(r.ok, false);
    assert.equal(r.status, 401);
  });

  it('denies non-members with 403', async () => {
    const r = await requireConversationMember(
      { findOne: async () => null },
      { conversationId: 10, userId: 5 }
    );
    assert.equal(r.ok, false);
    assert.equal(r.status, 403);
  });

  it('allows members', async () => {
    const membership = { id: 99, userId: 5, conversationId: 10 };
    const r = await requireConversationMember(
      { findOne: async () => membership },
      { conversationId: 10, userId: 5 }
    );
    assert.equal(r.ok, true);
    assert.equal(r.membership.id, 99);
  });
});
