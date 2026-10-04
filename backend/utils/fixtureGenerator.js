/**
 * Fixture planning. Pure functions — persistence lives in competitionService.
 * League uses the circle method. Knockout uses seeded byes. Groups use a snake seed.
 */

function nextPowerOfTwo(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function rotateCircle(rotation) {
  const fixed = rotation[0];
  const rest = rotation.slice(1);
  rest.unshift(rest.pop());
  return [fixed, ...rest];
}

/**
 * Single (or double) round-robin. A null slot is a bye and creates no fixture.
 * @returns {{ round: number, homeUserId: number, awayUserId: number, stage: string, leg: number }[]}
 */
function roundRobinFixtures(teamIds, { doubleRound = false, stage = 'league', groupName = null } = {}) {
  const teams = [...teamIds].map((id) => Number(id)).filter((id) => Number.isFinite(id));
  if (teams.length < 2) return [];
  const rotationSource = [...teams];
  if (rotationSource.length % 2 === 1) rotationSource.push(null);

  const n = rotationSource.length;
  const rounds = n - 1;
  const half = n / 2;
  let rotation = [...rotationSource];
  const firstLeg = [];

  for (let r = 0; r < rounds; r += 1) {
    for (let i = 0; i < half; i += 1) {
      let home = rotation[i];
      let away = rotation[n - 1 - i];
      if (home == null || away == null) continue;
      if ((r + i) % 2 === 1) {
        const swap = home;
        home = away;
        away = swap;
      }
      firstLeg.push({
        round: r + 1,
        homeUserId: home,
        awayUserId: away,
        stage,
        groupName,
        leg: 1,
      });
    }
    rotation = rotateCircle(rotation);
  }

  if (!doubleRound) return firstLeg;
  const secondLeg = firstLeg.map((fixture) => ({
    ...fixture,
    round: fixture.round + rounds,
    homeUserId: fixture.awayUserId,
    awayUserId: fixture.homeUserId,
    leg: 2,
  }));
  return [...firstLeg, ...secondLeg];
}

function knockoutRoundLabel(teamCount) {
  if (teamCount <= 2) return 'Final';
  if (teamCount <= 4) return 'Semifinal';
  if (teamCount <= 8) return 'Quarterfinal';
  if (teamCount <= 16) return 'Round of 16';
  return `Round of ${teamCount}`;
}

/**
 * Seeded first round. Higher seeds (earlier in the list) receive byes
 * when the field is not a power of two.
 */
function knockoutFirstRound(teamIds) {
  const teams = [...teamIds].map((id) => Number(id)).filter((id) => Number.isFinite(id));
  if (teams.length < 2) return [];
  const size = nextPowerOfTwo(teams.length);
  const byeCount = size - teams.length;
  const auto = teams.slice(0, byeCount);
  const playing = teams.slice(byeCount);
  const fixtures = [];

  for (let i = 0; i < playing.length; i += 2) {
    fixtures.push({
      round: 1,
      roundLabel: knockoutRoundLabel(size),
      homeUserId: playing[i],
      awayUserId: playing[i + 1],
      stage: 'knockout',
      groupName: null,
      walkover: false,
      leg: 1,
    });
  }

  auto.forEach((userId) => {
    fixtures.push({
      round: 1,
      roundLabel: knockoutRoundLabel(size),
      homeUserId: userId,
      awayUserId: null,
      stage: 'knockout',
      groupName: null,
      walkover: true,
      winnerUserId: userId,
      leg: 1,
    });
  });

  return fixtures;
}

function defaultGroupCount(teamCount) {
  const n = teamCount;
  if (n < 4) return 0;
  if (n <= 6) return 2;
  if (n % 4 === 0 && n / 4 >= 2) return 4;
  if (n % 3 === 0 && n / 3 >= 2) return 3;
  if (n % 2 === 0) return 2;
  return 2;
}

function assignGroups(teamIds, groupCount) {
  const teams = [...teamIds].map((id) => Number(id)).filter((id) => Number.isFinite(id));
  const count = groupCount || defaultGroupCount(teams.length);
  if (count < 2) {
    return { ok: false, msg: 'Group stage needs at least two groups.' };
  }
  const names = 'ABCDEFGH'.split('');
  const groups = Array.from({ length: count }, (_, i) => ({
    name: names[i] || `G${i + 1}`,
    teamIds: [],
  }));
  teams.forEach((id, index) => {
    const cycle = Math.floor(index / count);
    const pos = cycle % 2 === 0 ? index % count : count - 1 - (index % count);
    groups[pos].teamIds.push(id);
  });
  if (groups.some((g) => g.teamIds.length < 2)) {
    return { ok: false, msg: 'Each group needs at least two teams.' };
  }
  return { ok: true, groups };
}

function groupStageFixtures(teamIds, { groupCount, doubleRound = false } = {}) {
  const assigned = assignGroups(teamIds, groupCount);
  if (!assigned.ok) return assigned;
  const fixtures = [];
  for (const group of assigned.groups) {
    const groupFixtures = roundRobinFixtures(group.teamIds, {
      doubleRound,
      stage: 'group',
      groupName: group.name,
    });
    fixtures.push(...groupFixtures);
  }
  return { ok: true, groups: assigned.groups, fixtures };
}

function pairAdjacent(ids, round = 1) {
  const fixtures = [];
  for (let i = 0; i < ids.length; i += 2) {
    if (i + 1 >= ids.length) {
      fixtures.push({
        round,
        homeUserId: ids[i],
        awayUserId: null,
        stage: 'knockout',
        groupName: null,
        walkover: true,
        winnerUserId: ids[i],
        leg: 1,
      });
    } else {
      fixtures.push({
        round,
        homeUserId: ids[i],
        awayUserId: ids[i + 1],
        stage: 'knockout',
        groupName: null,
        walkover: false,
        leg: 1,
      });
    }
  }
  return fixtures;
}

/**
 * Cross-pair group winners with runners-up from another group.
 * `groupStandings` values are already ranked rows `{ userId }`.
 */
function planGroupQualification(groupStandings, qualifyPerGroup = 2) {
  const per = Math.max(1, Number(qualifyPerGroup) || 2);
  const qualified = [];
  const entries = Object.entries(groupStandings || {});
  if (entries.length < 2) {
    return { ok: false, msg: 'At least two groups are required to build a knockout round.' };
  }
  for (const [group, rows] of entries) {
    const list = Array.isArray(rows) ? rows : [];
    if (list.length < per) {
      return { ok: false, msg: `Group ${group} does not have enough teams to qualify ${per}.` };
    }
    list.slice(0, per).forEach((row, index) => {
      qualified.push({ userId: Number(row.userId), group, rank: index + 1 });
    });
  }

  const winners = qualified.filter((q) => q.rank === 1);
  const runners = qualified.filter((q) => q.rank === 2);
  if (!runners.length) {
    return { ok: true, qualified, fixtures: pairAdjacent(winners.map((w) => w.userId)) };
  }

  const fixtures = [];
  const used = new Set();
  for (let i = 0; i < winners.length; i += 1) {
    let chosen = null;
    for (let attempt = 0; attempt < runners.length; attempt += 1) {
      const candidate = runners[(i + 1 + attempt) % runners.length];
      if (used.has(candidate.userId)) continue;
      if (candidate.group === winners[i].group) continue;
      chosen = candidate;
      break;
    }
    if (!chosen) {
      return { ok: true, qualified, fixtures: pairAdjacent(qualified.map((q) => q.userId)) };
    }
    used.add(chosen.userId);
    fixtures.push({
      round: 1,
      roundLabel: knockoutRoundLabel(qualified.length),
      homeUserId: winners[i].userId,
      awayUserId: chosen.userId,
      stage: 'knockout',
      groupName: null,
      walkover: false,
      leg: 1,
    });
  }
  return { ok: true, qualified, fixtures };
}

function fixtureIdentity(fixture, { doubleRound = false } = {}) {
  const stage = fixture.stage || '';
  const group = fixture.groupName || '';
  if (fixture.walkover || fixture.awayUserId == null) {
    return `bye|${stage}|${group}|${fixture.round || 0}|${fixture.homeUserId}`;
  }
  if (doubleRound) {
    return `ord|${stage}|${group}|${fixture.homeUserId}|${fixture.awayUserId}`;
  }
  const pair = [Number(fixture.homeUserId), Number(fixture.awayUserId)].sort((a, b) => a - b);
  return `un|${stage}|${group}|${pair[0]}|${pair[1]}`;
}

function findDuplicateFixtures(fixtures, { doubleRound = false } = {}) {
  const seen = new Map();
  const duplicates = [];
  for (const fixture of fixtures || []) {
    const key = fixtureIdentity(fixture, { doubleRound });
    if (seen.has(key)) duplicates.push(fixture);
    else seen.set(key, fixture);
  }
  return duplicates;
}

function scheduleFixtureDates(fixtures, { startDate, endDate } = {}) {
  const start = startDate ? new Date(startDate) : new Date();
  if (Number.isNaN(start.getTime())) {
    return { ok: false, msg: 'Start date is invalid.' };
  }
  const end = endDate ? new Date(endDate) : null;
  if (end && Number.isNaN(end.getTime())) {
    return { ok: false, msg: 'End date is invalid.' };
  }
  if (end && end < start) {
    return { ok: false, msg: 'End date is before start date.' };
  }

  const rounds = [...new Set((fixtures || []).map((f) => Number(f.round) || 1))].sort((a, b) => a - b);
  const span = end ? end.getTime() - start.getTime() : Math.max(rounds.length - 1, 0) * 7 * 24 * 60 * 60 * 1000;
  const step = rounds.length > 1 ? span / (rounds.length - 1) : 0;

  const dated = (fixtures || []).map((fixture) => {
    const roundIndex = Math.max(0, rounds.indexOf(Number(fixture.round) || 1));
    const matchDate = new Date(start.getTime() + roundIndex * step);
    if (end && matchDate > end) {
      return { ...fixture, matchDate, invalid: true };
    }
    return { ...fixture, matchDate, invalid: false };
  });

  if (dated.some((f) => f.invalid)) {
    return { ok: false, msg: 'Fixture dates fall outside the competition window.' };
  }
  return { ok: true, fixtures: dated };
}

function planCompetitionFixtures(teamIds, options = {}) {
  const type = options.type;
  const teams = [...teamIds].map((id) => Number(id)).filter((id) => Number.isFinite(id));
  if (teams.length < 2) {
    return { ok: false, msg: 'Need at least 2 teams to create fixtures.' };
  }

  let planned;
  if (type === 'league') {
    planned = {
      ok: true,
      groups: [],
      fixtures: roundRobinFixtures(teams, { doubleRound: !!options.doubleRound, stage: 'league' }),
    };
  } else if (type === 'group_knockout') {
    planned = groupStageFixtures(teams, {
      groupCount: options.groupCount,
      doubleRound: !!options.doubleRound,
    });
  } else if (type === 'knockout' || type === 'cup' || type === 'tournament') {
    planned = { ok: true, groups: [], fixtures: knockoutFirstRound(teams) };
  } else {
    return { ok: false, msg: 'Unsupported competition type for fixtures.' };
  }
  if (!planned.ok) return planned;

  const duplicates = findDuplicateFixtures(planned.fixtures, { doubleRound: !!options.doubleRound });
  if (duplicates.length) {
    return { ok: false, msg: 'Fixture generation produced duplicate pairings.' };
  }

  const dated = scheduleFixtureDates(planned.fixtures, {
    startDate: options.startDate,
    endDate: options.endDate,
  });
  if (!dated.ok) return dated;

  return { ok: true, groups: planned.groups || [], fixtures: dated.fixtures };
}

module.exports = {
  nextPowerOfTwo,
  roundRobinFixtures,
  knockoutRoundLabel,
  knockoutFirstRound,
  defaultGroupCount,
  assignGroups,
  groupStageFixtures,
  planGroupQualification,
  pairAdjacent,
  fixtureIdentity,
  findDuplicateFixtures,
  scheduleFixtureDates,
  planCompetitionFixtures,
};
