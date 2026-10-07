'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSquadGroup, isYouthCategory, squadLabel, assignSquadGroup } = require('../utils/squadGroup');

describe('age squad groups', () => {
  it('accepts only A, B and C', () => {
    assert.equal(normalizeSquadGroup('a'), 'A');
    assert.equal(normalizeSquadGroup(' B '), 'B');
    assert.equal(normalizeSquadGroup('d'), null);
    assert.equal(normalizeSquadGroup(''), null);
  });

  it('treats U bands as youth and builds U13/A labels', () => {
    assert.equal(isYouthCategory('u13'), true);
    assert.equal(isYouthCategory('U13'), true);
    assert.equal(isYouthCategory('senior'), false);
    assert.equal(squadLabel('u13', 'a'), 'U13/A');
  });

  it('requires a letter for youth and clears it for seniors', () => {
    const youth = { competitionCategory: 'u13', squadGroup: null };
    assert.equal(assignSquadGroup(youth, null).ok, false);
    assert.equal(assignSquadGroup(youth, 'c').ok, true);
    assert.equal(youth.squadGroup, 'C');

    const senior = { competitionCategory: 'senior', squadGroup: 'A' };
    assert.equal(assignSquadGroup(senior, 'A').ok, true);
    assert.equal(senior.squadGroup, null);
  });
});
