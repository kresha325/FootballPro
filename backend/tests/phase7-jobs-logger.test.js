/**
 * Phase 7: production sync refusal, job flag, and logger levels.
 * Run: node --test tests/phase7-jobs-logger.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const path = require('path');

describe('logger', () => {
  it('stays silent during tests and drops messages below LOG_LEVEL', () => {
    const loggerPath = require.resolve('../utils/logger');
    delete require.cache[loggerPath];
    const previousEnv = process.env.NODE_ENV;
    const previousLevel = process.env.LOG_LEVEL;
    const calls = [];
    const original = { log: console.log, warn: console.warn, error: console.error };
    console.log = (...args) => calls.push(['log', ...args]);
    console.warn = (...args) => calls.push(['warn', ...args]);
    console.error = (...args) => calls.push(['error', ...args]);
    try {
      process.env.NODE_ENV = 'test';
      const logger = require('../utils/logger');
      logger.error('hidden');
      logger.info('hidden');
      assert.equal(calls.length, 0);

      process.env.NODE_ENV = 'development';
      process.env.LOG_LEVEL = 'error';
      logger.info('nope');
      logger.warn('nope');
      logger.error('yes');
      assert.deepEqual(calls, [['error', 'yes']]);
    } finally {
      console.log = original.log;
      console.warn = original.warn;
      console.error = original.error;
      if (previousEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousEnv;
      if (previousLevel === undefined) delete process.env.LOG_LEVEL;
      else process.env.LOG_LEVEL = previousLevel;
      delete require.cache[loggerPath];
    }
  });
});

describe('scheduled jobs flag', () => {
  it('runs unless RUN_JOBS is false or 0', () => {
    const previous = process.env.RUN_JOBS;
    const { jobsEnabled } = require('../jobs');
    try {
      delete process.env.RUN_JOBS;
      assert.equal(jobsEnabled(), true);
      process.env.RUN_JOBS = 'true';
      assert.equal(jobsEnabled(), true);
      process.env.RUN_JOBS = 'false';
      assert.equal(jobsEnabled(), false);
      process.env.RUN_JOBS = '0';
      assert.equal(jobsEnabled(), false);
    } finally {
      if (previous === undefined) delete process.env.RUN_JOBS;
      else process.env.RUN_JOBS = previous;
    }
  });
});

describe('syncDatabase production guard', () => {
  it('refuses to alter the schema in production even when destructive scripts are allowed', () => {
    const result = spawnSync(process.execPath, ['syncDatabase.js'], {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, NODE_ENV: 'production', ALLOW_DESTRUCTIVE: 'true' },
      encoding: 'utf8',
    });
    assert.notEqual(result.status, 0);
    assert.match(String(result.stderr), /not allowed when NODE_ENV=production/);
  });
});
