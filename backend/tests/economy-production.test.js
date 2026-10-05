const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { toCents, fromCents, percentOfCents } = require('../utils/money');
const { splitGross, priceToJoncoinCents, getJoncoinPerEur } = require('../config/economy');
const {
  claimUnits,
  purchaseBlockReason,
  assertStatusTransition,
  canAccessOrder,
  canReadWallet,
  canRefund,
  sameIdempotentPayload,
} = require('../services/economy/rules');
const { normalizeOrderCart } = require('../utils/orderCart');
const { isProActive } = require('../utils/subscriptionAccess');

function createLock() {
  let tail = Promise.resolve();
  return (fn) => {
    const run = tail.then(fn, fn);
    tail = run.then(() => {}, () => {});
    return run;
  };
}

describe('money', () => {
  it('parses decimal strings as cents and rejects floats and negatives that are not exact', () => {
    assert.equal(toCents('10.50'), 1050);
    assert.equal(toCents('10.5'), 1050);
    assert.equal(toCents('10'), 1000);
    assert.equal(toCents('10.555'), null);
    assert.equal(toCents('-1.00'), -100);
    assert.equal(fromCents(1050), '10.50');
    assert.equal(percentOfCents(1000, 5), 50);
  });

  it('uses one JonCoin per EUR unless the environment overrides it', () => {
    const previous = process.env.JONCOIN_PER_EUR;
    delete process.env.JONCOIN_PER_EUR;
    assert.equal(getJoncoinPerEur(), 1);
    assert.equal(priceToJoncoinCents('11.99'), 1199);
    process.env.JONCOIN_PER_EUR = '2';
    assert.equal(priceToJoncoinCents('10.00'), 2000);
    if (previous == null) delete process.env.JONCOIN_PER_EUR;
    else process.env.JONCOIN_PER_EUR = previous;
  });

  it('splits a sale into gross, fee and net without floating point', () => {
    const split = splitGross(10000, 10);
    assert.deepEqual(split, { grossCents: 10000, feeCents: 1000, netCents: 9000 });
    assert.equal(split.grossCents, split.feeCents + split.netCents);
  });
});

describe('catalog and cart', () => {
  it('blocks inactive, paused, zero price and oversell quantities', () => {
    assert.equal(purchaseBlockReason({ status: 'paused', price: '10.00', stock: 4, acceptsJoncoin: true }, 1), 'Produkti nuk është në shitje');
    assert.equal(purchaseBlockReason({ status: 'active', price: '0.00', stock: 4, acceptsJoncoin: true }, 1), 'Çmimi i produktit është i pavlefshëm');
    assert.equal(purchaseBlockReason({ status: 'active', price: '10.00', stock: 1, acceptsJoncoin: true }, 2), 'Nuk ka stok të mjaftueshëm');
    assert.equal(purchaseBlockReason({ status: 'active', price: '10.00', stock: 2, acceptsJoncoin: false }, 1), 'Ky produkt nuk shitet me XCoin');
    assert.equal(purchaseBlockReason({ status: 'active', price: '10.00', stock: 2, acceptsJoncoin: true }, 1), null);
  });

  it('rejects negative quantity instead of coercing it to one', () => {
    const bad = normalizeOrderCart([{ productId: 4, quantity: -3 }]);
    assert.equal(bad.ok, false);
    const good = normalizeOrderCart([{ productId: 4, quantity: 2 }, { productId: 4, quantity: 1 }]);
    assert.equal(good.quantityByProductId[4], 3);
  });
});

describe('order lifecycle and access', () => {
  const seller = { id: 2, role: 'athlete' };
  const buyer = { id: 9, role: 'athlete' };
  const stranger = { id: 3, role: 'athlete' };
  const order = { id: 1, userId: 9, sellerId: 2, status: 'paid' };

  it('allows only the next fulfillment states and seller refunds', () => {
    assert.doesNotThrow(() => assertStatusTransition('paid', 'processing', seller, order));
    assert.throws(() => assertStatusTransition('paid', 'cancelled', seller, { ...order, status: 'paid' }), /nuk lejohet|leje/);
    assert.throws(() => assertStatusTransition('pending', 'paid', buyer, { ...order, status: 'pending' }), /nuk lejohet/);
    assert.doesNotThrow(() => assertStatusTransition('pending', 'cancelled', buyer, { ...order, status: 'pending', userId: 9 }));
    assert.throws(() => assertStatusTransition('delivered', 'refunded', buyer, { ...order, status: 'delivered' }), /shitësi/);
    assert.equal(canRefund({ ...order, status: 'delivered' }, seller), true);
    assert.equal(canRefund({ ...order, status: 'delivered' }, buyer), false);
  });

  it('hides other users orders and wallets', () => {
    assert.equal(canAccessOrder(order, stranger), false);
    assert.equal(canAccessOrder(order, buyer), true);
    assert.equal(canAccessOrder(order, seller), true);
    assert.equal(canReadWallet(9, buyer), true);
    assert.equal(canReadWallet(9, stranger), false);
  });
});

describe('idempotency and concurrency', () => {
  it('rejects a reused key when the amount changes', () => {
    const existing = { userId: 1, type: 'spend', amount: '10.00' };
    assert.equal(sameIdempotentPayload(existing, { userId: 1, type: 'spend', amountCents: 1000 }), true);
    assert.equal(sameIdempotentPayload(existing, { userId: 1, type: 'spend', amountCents: 1001 }), false);
  });

  it('lets only one of two locked claims take the last unit of stock', async () => {
    const lock = createLock();
    const state = { stock: 1 };
    const buy = () => lock(() => {
      const claim = claimUnits(state.stock, 1);
      if (!claim.ok) return false;
      state.stock = claim.available;
      return true;
    });
    const [a, b] = await Promise.all([buy(), buy()]);
    assert.equal(a + b, 1);
    assert.equal(state.stock, 0);
  });

  it('lets only one of two locked claims spend the full balance', async () => {
    const lock = createLock();
    const state = { balance: 1000 };
    const spend = () => lock(() => {
      const claim = claimUnits(state.balance, 1000);
      if (!claim.ok) return false;
      state.balance = claim.available;
      return true;
    });
    const [a, b] = await Promise.all([spend(), spend()]);
    assert.equal([a, b].filter(Boolean).length, 1);
    assert.equal(state.balance, 0);
    assert.equal(claimUnits(0, 1).ok, false);
  });
});

describe('premium authority', () => {
  it('expires premium from the backend date instead of a client flag', () => {
    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 60_000);
    assert.equal(isProActive({ premium: true, premiumExpiresAt: past, subscriptionPlan: 'premium' }), false);
    assert.equal(isProActive({ premium: true, premiumExpiresAt: future, subscriptionPlan: 'premium' }), true);
  });
});
