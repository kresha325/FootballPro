/**
 * Competition engine tests (no database).
 * Covers lifecycle, fixtures, standings, results, events, qualification, and permissions.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  canTransition,
  assertCanStart,
  assertRegistration,
  assertResultMutation,
  validateCompetitionInput,
  resolveLifecycle,
  minimumTeams,
} = require('../utils/competitionLifecycle');
const {
  roundRobinFixtures,
  planCompetitionFixtures,
  findDuplicateFixtures,
  planGroupQualification,
} = require('../utils/fixtureGenerator');
const { standingsFromMatches } = require('../utils/standingsEngine');
const {
  validateOfficialResult,
  validateMatchEvent,
  planKnockoutAdvancement,
} = require('../utils/matchResult');
const { aggregatePlayerStats } = require('../utils/playerStatsEngine');
const { canFillMatchStats } = require('../utils/matchPermissions');

describe('competition lifecycle', () => {
  it('creates a valid competition payload', () => {
    const result = validateCompetitionInput({
      name: 'Prishtina Cup',
      type: 'knockout',
      startDate: '2026-08-01',
      endDate: '2026-08-20',
      registrationDeadline: '2026-07-20',
      gender: 'open',
      maxParticipants: 16,
    });
    assert.equal(result.ok, true);
  });

  it('rejects an end date before the start date', () => {
    const result = validateCompetitionInput({
      name: 'Cup',
      type: 'league',
      startDate: '2026-09-01',
      endDate: '2026-08-01',
      maxParticipants: 8,
    });
    assert.equal(result.ok, false);
    assert.match(result.msg, /End date is before start date/);
  });

  it('registers a team once and blocks duplicates', () => {
    const open = { lifecycle: 'registration', status: 'open' };
    const first = assertRegistration({ existingUserIds: [2], userId: 4, maxParticipants: 8, tournament: open });
    assert.equal(first.ok, true);
    const again = assertRegistration({ existingUserIds: [2, 4], userId: 4, maxParticipants: 8, tournament: open });
    assert.equal(again.ok, false);
    assert.equal(again.status, 409);
  });

  it('does not start without the required teams', () => {
    const blocked = assertCanStart({ type: 'group_knockout', lifecycle: 'registration' }, 3);
    assert.equal(blocked.ok, false);
    assert.equal(minimumTeams('group_knockout'), 4);
    const ready = assertCanStart({ type: 'league', lifecycle: 'registration' }, 2);
    assert.equal(ready.ok, true);
  });

  it('follows the production lifecycle', () => {
    assert.equal(canTransition('registration', 'active').ok, true);
    assert.equal(canTransition('active', 'in_progress').ok, true);
    assert.equal(canTransition('in_progress', 'completed').ok, true);
    assert.equal(canTransition('completed', 'registration').ok, false);
    assert.equal(canTransition('open', 'cancelled').lifecycle, 'cancelled');
    assert.equal(resolveLifecycle({ status: 'ongoing' }), 'in_progress');
  });

  it('locks a completed competition', () => {
    const locked = assertResultMutation({ lifecycle: 'completed', status: 'finished' });
    assert.equal(locked.ok, false);
    assert.equal(locked.status, 409);
    const open = assertResultMutation({ lifecycle: 'in_progress', status: 'ongoing' });
    assert.equal(open.ok, true);
  });
});

describe('fixture generation', () => {
  it('builds a round robin for an even number of teams without duplicate pairings', () => {
    const fixtures = roundRobinFixtures([1, 2, 3, 4]);
    assert.equal(fixtures.length, 6);
    assert.equal(findDuplicateFixtures(fixtures).length, 0);
    const rounds = new Set(fixtures.map((f) => f.round));
    assert.equal(rounds.size, 3);
  });

  it('builds a round robin for an odd number of teams', () => {
    const fixtures = roundRobinFixtures([1, 2, 3]);
    assert.equal(fixtures.length, 3);
    assert.equal(findDuplicateFixtures(fixtures).length, 0);
    for (const id of [1, 2, 3]) {
      const played = fixtures.filter((f) => f.homeUserId === id || f.awayUserId === id).length;
      assert.equal(played, 2);
    }
  });

  it('creates the return leg when home and away is enabled', () => {
    const plan = planCompetitionFixtures([1, 2, 3, 4], {
      type: 'league',
      doubleRound: true,
      startDate: '2026-08-01',
      endDate: '2027-05-01',
    });
    assert.equal(plan.ok, true);
    assert.equal(plan.fixtures.length, 12);
    assert.equal(findDuplicateFixtures(plan.fixtures, { doubleRound: true }).length, 0);
  });

  it('rejects duplicate fixtures', () => {
    const duplicates = findDuplicateFixtures([
      { homeUserId: 1, awayUserId: 2, stage: 'league', round: 1 },
      { homeUserId: 2, awayUserId: 1, stage: 'league', round: 2 },
    ]);
    assert.equal(duplicates.length, 1);
  });

  it('rejects fixture dates outside the competition window', () => {
    const plan = planCompetitionFixtures([1, 2, 3, 4], {
      type: 'league',
      startDate: '2026-08-10',
      endDate: '2026-08-01',
    });
    assert.equal(plan.ok, false);
    assert.match(plan.msg, /End date is before start date/);
  });

  it('seeds a knockout first round and gives byes to extra teams', () => {
    const plan = planCompetitionFixtures([1, 2, 3, 4, 5], {
      type: 'knockout',
      startDate: '2026-08-01',
      endDate: '2026-08-30',
    });
    assert.equal(plan.ok, true);
    const byes = plan.fixtures.filter((f) => f.walkover);
    const played = plan.fixtures.filter((f) => !f.walkover);
    assert.equal(byes.length, 3);
    assert.equal(played.length, 1);
    assert.equal(findDuplicateFixtures(plan.fixtures).length, 0);
  });
});

describe('standings', () => {
  it('awards 3, 1, and 0 points from official results', () => {
    const rows = standingsFromMatches([1, 2, 3], [
      { homeUserId: 1, awayUserId: 2, scoreHome: 2, scoreAway: 0, status: 'finished' },
      { homeUserId: 1, awayUserId: 3, scoreHome: 1, scoreAway: 1, status: 'finished' },
      { homeUserId: 2, awayUserId: 3, scoreHome: 0, scoreAway: 1, status: 'finished' },
    ]);
    const byId = Object.fromEntries(rows.map((row) => [row.userId, row]));
    assert.equal(byId[1].points, 4);
    assert.equal(byId[1].played, 2);
    assert.equal(byId[3].points, 4);
    assert.equal(byId[2].points, 0);
    assert.equal(byId[3].goalDifference, 1);
    assert.equal(rows[0].userId, 1);
    assert.equal(rows[1].userId, 3);
  });

  it('uses head-to-head before overall goal difference', () => {
    const table = standingsFromMatches([1, 2, 3, 4], [
      { homeUserId: 1, awayUserId: 2, scoreHome: 1, scoreAway: 0, status: 'finished' },
      { homeUserId: 1, awayUserId: 3, scoreHome: 0, scoreAway: 0, status: 'finished' },
      { homeUserId: 2, awayUserId: 4, scoreHome: 6, scoreAway: 0, status: 'finished' },
      { homeUserId: 2, awayUserId: 3, scoreHome: 0, scoreAway: 0, status: 'finished' },
    ]);
    const team1 = table.find((row) => row.userId === 1);
    const team2 = table.find((row) => row.userId === 2);
    assert.equal(team1.points, 4);
    assert.equal(team2.points, 4);
    assert.ok(team2.goalDifference > team1.goalDifference);
    assert.equal(table[0].userId, 1);
    assert.equal(table[1].userId, 2);
  });

  it('ignores scheduled matches', () => {
    const rows = standingsFromMatches([1, 2], [
      { homeUserId: 1, awayUserId: 2, scoreHome: 3, scoreAway: 0, status: 'scheduled' },
    ]);
    assert.equal(rows[0].played, 0);
    assert.equal(rows[0].points, 0);
  });
});

describe('match results and events', () => {
  it('rejects an invalid score', () => {
    const result = validateOfficialResult({
      scoreHome: -1,
      scoreAway: 0,
      competitionType: 'league',
      homeUserId: 1,
      awayUserId: 2,
    });
    assert.equal(result.ok, false);
  });

  it('rejects a knockout draw without a decider', () => {
    const result = validateOfficialResult({
      scoreHome: 1,
      scoreAway: 1,
      competitionType: 'knockout',
      stage: 'knockout',
      homeUserId: 1,
      awayUserId: 2,
    });
    assert.equal(result.ok, false);
    assert.match(result.msg, /cannot end in a draw/);
  });

  it('records a goal event shape and determines the winner', () => {
    const result = validateOfficialResult({
      scoreHome: 1,
      scoreAway: 0,
      competitionType: 'league',
      stage: 'league',
      homeUserId: 1,
      awayUserId: 2,
      goalEvents: [{ userId: 9, side: 'home', minute: 12 }],
    });
    assert.equal(result.ok, true);
    assert.equal(result.patch.winnerUserId, 1);
    assert.equal(result.patch.status, 'finished');
  });

  it('uses penalties to name the winner', () => {
    const result = validateOfficialResult({
      scoreHome: 1,
      scoreAway: 1,
      penaltiesHome: 4,
      penaltiesAway: 5,
      competitionType: 'knockout',
      stage: 'knockout',
      homeUserId: 1,
      awayUserId: 2,
    });
    assert.equal(result.ok, true);
    assert.equal(result.patch.winnerUserId, 2);
    assert.equal(result.patch.decidedBy, 'penalties');
  });

  it('records a yellow card', () => {
    const event = validateMatchEvent({ type: 'yellow_card', userId: 9, side: 'home', minute: 40 }, { homeUserId: 1, awayUserId: 2 });
    assert.equal(event.ok, true);
    assert.equal(event.event.type, 'yellow_card');
  });

  it('records a substitution and rejects a duplicate shape', () => {
    const event = validateMatchEvent({
      type: 'substitution',
      userId: 3,
      relatedUserId: 4,
      side: 'away',
      minute: 70,
    }, { homeUserId: 1, awayUserId: 2 });
    assert.equal(event.ok, true);
    const same = validateMatchEvent({
      type: 'substitution',
      userId: 3,
      relatedUserId: 4,
      side: 'away',
      minute: 70,
    }, { homeUserId: 1, awayUserId: 2 });
    assert.equal(same.event.eventKey, event.event.eventKey);
  });

  it('advances knockout winners and stops on a draw', () => {
    const undecided = planKnockoutAdvancement([
      { id: 1, round: 1, status: 'finished', homeUserId: 1, awayUserId: 2, scoreHome: 1, scoreAway: 1 },
    ]);
    assert.equal(undecided.ok, false);
    const next = planKnockoutAdvancement([
      { id: 1, round: 1, position: 0, status: 'finished', homeUserId: 1, awayUserId: 2, scoreHome: 2, scoreAway: 1 },
      { id: 2, round: 1, position: 1, status: 'finished', homeUserId: 3, awayUserId: 4, scoreHome: 0, scoreAway: 1 },
    ]);
    assert.equal(next.ok, true);
    assert.equal(next.fixtures.length, 1);
    assert.equal(next.fixtures[0].homeUserId, 1);
    assert.equal(next.fixtures[0].awayUserId, 4);
    const final = planKnockoutAdvancement([
      { id: 3, round: 2, status: 'finished', homeUserId: 1, awayUserId: 4, scoreHome: 3, scoreAway: 0, winnerUserId: 1 },
    ]);
    assert.equal(final.championUserId, 1);
  });

  it('qualifies group winners into a knockout bracket', () => {
    const plan = planGroupQualification({
      A: [{ userId: 1 }, { userId: 2 }, { userId: 3 }],
      B: [{ userId: 4 }, { userId: 5 }, { userId: 6 }],
    }, 2);
    assert.equal(plan.ok, true);
    assert.equal(plan.fixtures.length, 2);
    const paired = plan.fixtures.map((f) => [f.homeUserId, f.awayUserId].sort().join('-'));
    assert.equal(new Set(paired).size, 2);
    const teams = plan.fixtures.flatMap((f) => [f.homeUserId, f.awayUserId]);
    assert.deepEqual(teams.sort((a, b) => a - b), [1, 2, 4, 5]);
  });
});

describe('player statistics and permissions', () => {
  it('does not double-count goals stored as both scorers and events', () => {
    const players = aggregatePlayerStats({
      scorers: [{ matchId: 1, userId: 9, goals: 1, assistUserId: 8 }],
      events: [
        { matchId: 1, userId: 9, type: 'goal' },
        { matchId: 1, userId: 9, type: 'yellow_card' },
        { matchId: 1, userId: 8, type: 'assist' },
      ],
      statRows: [{ matchId: 1, userId: 9, minutes: 90, started: true, goals: 1, shots: 3, shotsOnTarget: 2 }],
    });
    const scorer = players.find((p) => p.userId === 9);
    const assister = players.find((p) => p.userId === 8);
    assert.equal(scorer.goals, 1);
    assert.equal(scorer.yellowCards, 1);
    assert.equal(scorer.appearances, 1);
    assert.equal(scorer.shots, 3);
    assert.equal(assister.assists, 1);
  });

  it('rejects an unauthorized result change', () => {
    const denied = canFillMatchStats({ creatorId: 4 }, { id: 9, role: 'athlete' }, { id: 1 });
    assert.equal(denied.ok, false);
    assert.equal(denied.status, 403);
    const allowed = canFillMatchStats({ creatorId: 4 }, { id: 4, role: 'liga' }, { id: 1 });
    assert.equal(allowed.ok, true);
  });
});
