'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const sequelize = require('../config/database');
const { User, WithdrawalRequest, JonCoinTransaction } = require('../models');
const { withdraw } = require('../controllers/joncoin');

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('withdraw retries reuse one hold/request and reject changed payloads', async () => {
  const original = {
    transaction: sequelize.transaction,
    findUser: User.findByPk,
    findLedger: JonCoinTransaction.findOne,
    listLedger: JonCoinTransaction.findAll,
    createLedger: JonCoinTransaction.create,
    createWithdrawal: WithdrawalRequest.create,
    findWithdrawal: WithdrawalRequest.findByPk,
  };

  const tx = { LOCK: { UPDATE: 'UPDATE' }, afterCommit() {} };
  const user = { id: 7, joncoinBalance: '50.00', async save() {} };
  let ledgerEntry = null;
  let createCount = 0;
  const withdrawal = { id: 81, userId: 7, amount: '9.50', status: 'pending' };
  sequelize.transaction = async (callback) => callback(tx);
  User.findByPk = async () => user;
  JonCoinTransaction.findAll = async ({ where }) => (
    where?.status === 'completed'
      ? [{ userId: 7, type: 'purchase', amount: '50.00', status: 'completed' }]
      : []
  );
  JonCoinTransaction.findOne = async ({ where }) => (where.idempotencyKey ? ledgerEntry : null);
  WithdrawalRequest.create = async (attributes, options) => {
    assert.equal(options.transaction, tx);
    createCount += 1;
    return { ...withdrawal, ...attributes };
  };
  WithdrawalRequest.findByPk = async (id, options) => {
    assert.equal(id, 81);
    assert.equal(options.transaction, tx);
    return withdrawal;
  };
  JonCoinTransaction.create = async (attributes, options) => {
    assert.equal(options.transaction, tx);
    ledgerEntry = { relatedEntityId: 81, ...attributes };
    return ledgerEntry;
  };

  const request = (amount) => ({ user: { id: 7 }, body: { amount }, get: () => 'withdraw-once' });
  try {
    const first = response();
    await withdraw(request(10), first);
    assert.equal(first.statusCode, 200);
    assert.equal(first.body.duplicate, false);
    assert.equal(first.body.grossAmount, '10.00');
    assert.equal(first.body.feeAmount, '0.50');
    assert.equal(first.body.netPayout, '9.50');

    const retry = response();
    await withdraw(request(10), retry);
    assert.equal(retry.statusCode, 200);
    assert.equal(retry.body.duplicate, true);
    assert.equal(retry.body.withdrawal.id, 81);
    assert.equal(createCount, 1);

    const changed = response();
    await withdraw(request(11), changed);
    assert.equal(changed.statusCode, 409);
    assert.equal(createCount, 1);
  } finally {
    sequelize.transaction = original.transaction;
    User.findByPk = original.findUser;
    JonCoinTransaction.findOne = original.findLedger;
    JonCoinTransaction.findAll = original.listLedger;
    JonCoinTransaction.create = original.createLedger;
    WithdrawalRequest.create = original.createWithdrawal;
    WithdrawalRequest.findByPk = original.findWithdrawal;
  }
});
