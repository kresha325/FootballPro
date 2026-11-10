'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const ClubMember = require('../models/ClubMember');
const router = require('../routes/clubMembers');
const squadSync = require('../utils/tournamentSquad');
const ligaSync = require('../utils/ligaTournaments');

const route = router.stack.find((layer) => layer.route?.path === '/:membershipId' && layer.route.methods.delete);
const handler = route.route.stack.at(-1).handle;

function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

describe('club member removal authorization', () => {
  const originalFindByPk = ClubMember.findByPk;
  const originalRemoveSquads = squadSync.removeAthleteFromClubSquads;
  const originalRemoveLiga = ligaSync.removeAthleteFromClubLigaTournaments;

  it('rejects non-club roles even when the membership belongs to their user ID', async () => {
    let destroyed = false;
    ClubMember.findByPk = async () => ({
      id: 42,
      clubId: 8,
      athleteId: 91,
      destroy: async () => { destroyed = true; },
    });
    try {
      const res = response();
      await handler({ params: { membershipId: '42' }, user: { id: 8, role: 'coach' } }, res);
      assert.equal(res.statusCode, 403);
      assert.equal(destroyed, false);
    } finally {
      ClubMember.findByPk = originalFindByPk;
    }
  });

  it('allows the owning club to remove a membership with string JWT IDs', async () => {
    let destroyed = false;
    let squadRemoval;
    let ligaRemoval;
    ClubMember.findByPk = async () => ({
      id: 42,
      clubId: 8,
      athleteId: 91,
      destroy: async () => { destroyed = true; },
    });
    squadSync.removeAthleteFromClubSquads = async (...args) => { squadRemoval = args; };
    ligaSync.removeAthleteFromClubLigaTournaments = async (...args) => { ligaRemoval = args; };
    try {
      const res = response();
      await handler({ params: { membershipId: '42' }, user: { id: '8', role: 'club' } }, res);
      assert.equal(res.statusCode, 200);
      assert.equal(destroyed, true);
      assert.deepEqual(squadRemoval, [8, 91]);
      assert.deepEqual(ligaRemoval, [91, 8]);
    } finally {
      ClubMember.findByPk = originalFindByPk;
      squadSync.removeAthleteFromClubSquads = originalRemoveSquads;
      ligaSync.removeAthleteFromClubLigaTournaments = originalRemoveLiga;
    }
  });
});
