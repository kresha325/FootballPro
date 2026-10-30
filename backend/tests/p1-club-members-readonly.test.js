'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('club membership list is read-only', () => {
  it('does not create, update, or delete ClubMember records in its GET handler', () => {
    const source = fs.readFileSync(path.join(__dirname, '../routes/clubMembers.js'), 'utf8');
    const getStart = source.indexOf("router.get('/club/:clubId'");
    const nextRoute = source.indexOf("router.", getStart + 10);
    assert.notEqual(getStart, -1);
    const getHandler = source.slice(getStart, nextRoute === -1 ? source.length : nextRoute);
    assert.doesNotMatch(getHandler, /ClubMember\.(?:create|bulkCreate|update|destroy|upsert)\s*\(/);
    assert.match(getHandler, /ClubMember\.findAll\s*\(/);
  });

  it('keeps existing memberships as the source of roster data and does not fuzzy-import profiles', () => {
    const source = fs.readFileSync(path.join(__dirname, '../routes/clubMembers.js'), 'utf8');
    const getStart = source.indexOf("router.get('/club/:clubId'");
    const nextRoute = source.indexOf("router.", getStart + 10);
    const getHandler = source.slice(getStart, nextRoute === -1 ? source.length : nextRoute);
    assert.match(getHandler, /ClubMember\.findAll\s*\(/);
    assert.doesNotMatch(getHandler, /clubProfile\.club|profile\.club\s*\?\?/);
  });
});
