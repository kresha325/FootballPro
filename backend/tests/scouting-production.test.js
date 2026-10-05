const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  comparisonPeriod,
  diffWatchSnapshot,
  isDuplicateReport,
  omitPrivateFields,
  ownsRecord,
  parseIdList,
  parsePage,
  parseRating,
  rankAthlete,
  statsForPeriod,
  trendFor,
  validateReportPayload,
  validateShortlistPatch,
} = require('../utils/scoutingEngine');

describe('scouting ratings', () => {
  it('rejects ratings outside 1 to 10 and keeps one decimal', () => {
    assert.equal(parseRating(0).ok, false);
    assert.equal(parseRating(10.1).ok, false);
    assert.equal(parseRating('8.24').value, 8.2);
    assert.equal(parseRating('').value, null);
  });

  it('calculates category and overall ratings only from supplied criteria', () => {
    const report = validateReportPayload({
      status: 'completed',
      recommendation: 'shortlist',
      technical: { passing: 8.2, firstTouch: 8.2 },
      physical: { speed: 7.5 },
      tactical: { positioning: 8 },
      mental: { composure: 7.8 },
      potentialRating: 9,
      positionSpecific: { movementInBox: 8 },
    }, 'Forward');
    assert.equal(report.ok, true);
    assert.equal(report.value.technicalRating, 8.2);
    assert.equal(report.value.physicalRating, 7.5);
    assert.equal(report.value.tacticalRating, 8);
    assert.equal(report.value.mentalRating, 7.8);
    assert.equal(report.value.potentialRating, 9);
    assert.equal(report.value.overallRating, 8.1);
    assert.equal(report.value.recommendation, 'SHORTLIST');
  });

  it('allows a partial draft and blocks an empty report', () => {
    const partial = validateReportPayload({ notes: 'Pamje e parë', status: 'draft' }, 'Goalkeeper');
    assert.equal(partial.ok, true);
    assert.equal(partial.value.overallRating, null);
    assert.equal(partial.value.positionGroup, 'goalkeeper');
    const empty = validateReportPayload({}, 'Forward');
    assert.equal(empty.ok, false);
  });

  it('uses winger criteria instead of treating every attacker as a forward', () => {
    const report = validateReportPayload({
      notes: 'Krah',
      positionSpecific: { oneVsOne: 7, movementInBox: 9 },
    }, 'Winger');
    assert.equal(report.ok, false);
    assert.equal(report.field, 'positionSpecific');
  });
});

describe('scouting ownership and duplicates', () => {
  it('hides another scout report by ownership', () => {
    assert.equal(ownsRecord(4, 4), true);
    assert.equal(ownsRecord(4, 9), false);
  });

  it('treats the same match, or a second same-day note without a match, as a duplicate', () => {
    const today = new Date();
    assert.equal(isDuplicateReport({ matchId: 12, createdAt: today }, { matchId: 12 }), true);
    assert.equal(isDuplicateReport({ matchId: 12, createdAt: today }, { matchId: 13 }), false);
    assert.equal(isDuplicateReport({ matchId: null, createdAt: today }, { matchId: null }), true);
    assert.equal(isDuplicateReport({ matchId: null, createdAt: new Date('2020-01-01') }, { matchId: null }), false);
  });

  it('rejects shortlist values outside the allowed sets', () => {
    assert.equal(validateShortlistPatch({ status: 'MAYBE' }).ok, false);
    assert.equal(validateShortlistPatch({ priority: 'urgent' }).value.priority, 'URGENT');
  });
});

describe('scouting ranking', () => {
  it('does not invent match statistics when none exist', () => {
    const ranked = rankAthlete({
      official: null,
      completenessPercent: 40,
      verified: false,
      scout: {},
    });
    assert.equal(ranked.insufficientMatchData, true);
    assert.equal(ranked.ranking.globalPerformance.factors.some((item) => item.key === 'goals'), false);
    assert.equal(ranked.ranking.scoutEvaluation, null);
    assert.equal(ranked.ranking.blend.scoutWeight, 0);
  });

  it('keeps official performance separate from scout preference fit', () => {
    const ranked = rankAthlete({
      official: { appearances: 10, goals: 8, assists: 3, minutes: 900, rating: 7.5 },
      form: { last5: { appearances: 5, goals: 3, assists: 1, rating: 8 } },
      completenessPercent: 80,
      verified: true,
      scout: {
        positions: ['forward'],
        minAge: 16,
        maxAge: 21,
        countries: ['Albania'],
        foot: 'right',
        playerPosition: 'Forward',
        playerAge: 18,
        playerCountry: 'Albania',
        playerFoot: 'right',
      },
    });
    assert.ok(ranked.ranking.globalPerformance.score > 0);
    assert.equal(ranked.ranking.scoutEvaluation.score, 100);
    assert.notEqual(ranked.ranking.globalPerformance.score, ranked.ranking.scoutEvaluation.score);
    assert.equal(ranked.ranking.blend.globalWeight, 0.75);
  });

  it('does not score recent form from fewer than three matches', () => {
    const ranked = rankAthlete({
      official: { appearances: 1, goals: 1, minutes: 90, rating: 7 },
      form: { last5: { appearances: 1, goals: 1, rating: 9 } },
      verified: false,
    });
    assert.equal(ranked.ranking.globalPerformance.factors.some((item) => item.key === 'form'), false);
  });
});

describe('scouting comparison and watch changes', () => {
  it('labels season and career as different periods', () => {
    const season = comparisonPeriod({ window: 'season', season: '2026/2027' });
    const career = comparisonPeriod({ window: 'career', season: '2026/2027' });
    assert.equal(season.label, 'Season 2026/2027');
    assert.equal(career.label, 'Career');
    assert.equal(career.season, null);
    const report = {
      hasOfficial: true,
      career: { appearances: 20, goals: 9, minutes: 1600, rating: 7 },
      season: { appearances: 4, goals: 2, minutes: 300, rating: 6.5 },
      form: { last5: { appearances: 2, goals: 1, minutes: 120, rating: 7 } },
      trend: [{ matchId: 3, goals: 1, assists: 0, minutes: 80, rating: 7 }],
    };
    assert.equal(statsForPeriod(report, season).goals, 2);
    assert.equal(statsForPeriod(report, career).goals, 9);
    assert.equal(statsForPeriod(report, { window: 'last5' }).insufficient, true);
    assert.equal(trendFor(report, 'last5').insufficient, true);
    assert.equal(trendFor({ trend: [] }, 'last10').matches.length, 0);
  });

  it('accepts two to four players and pages without loading an unbounded page', () => {
    assert.equal(parseIdList('1,2,2').ok, true);
    assert.equal(parseIdList('1').ok, false);
    assert.equal(parseIdList('1,2,3,4,5').ok, false);
    assert.equal(parsePage({ page: 2, limit: 500 }).limit, 40);
    assert.equal(parsePage({ page: 2, limit: 10 }).offset, 10);
  });

  it('ignores the first snapshot and does not alert when nothing changed', () => {
    const current = { club: 'KF', goals: 2, assists: 1, rating: 7, latestMatchId: 4, competitionIds: [1], achievementCount: 0, videoCount: 1 };
    assert.deepEqual(diffWatchSnapshot({ ...current, initialized: false }, current), []);
    assert.deepEqual(diffWatchSnapshot({ ...current, initialized: true }, current), []);
  });

  it('alerts only for a real club, match, performance, achievement or video change', () => {
    const previous = {
      initialized: true,
      club: 'KF A',
      goals: 1,
      assists: 0,
      rating: 6.5,
      latestMatchId: 4,
      competitionIds: [1],
      achievementCount: 0,
      videoCount: 0,
    };
    const changes = diffWatchSnapshot(previous, {
      ...previous,
      club: 'KF B',
      goals: 2,
      latestMatchId: 8,
      competitionIds: [1, 2],
      competitions: [{ id: 2, name: 'Kupa' }],
      achievementCount: 1,
      videoCount: 1,
    });
    assert.deepEqual(changes.map((item) => item.type), ['club', 'competition', 'match', 'performance', 'achievement', 'video']);
  });
});

describe('scouting privacy', () => {
  it('removes contact fields from a scouting card', () => {
    const card = omitPrivateFields({
      playerName: 'Ana',
      email: 'ana@example.com',
      phone: '123',
      contact: { agent: 'X' },
      parentEmail: 'parent@example.com',
    });
    assert.equal(card.playerName, 'Ana');
    assert.equal(card.email, undefined);
    assert.equal(card.phone, undefined);
    assert.equal(card.contact, undefined);
    assert.equal(card.parentEmail, undefined);
  });
});
