const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildPerformanceReport,
  enrichCareerEntries,
  buildCompleteness,
  stripAuthoritativeStats,
  validateFootballStats,
  sanitizeAchievements,
  mergeAchievements,
  positionSlice,
} = require('../utils/playerProfileCv');
const { applyProfilePrivacy, parsePrivacyInput, canView } = require('../utils/profilePrivacy');

describe('official player statistics', () => {
  it('does not double-count goals already stored on the scorer row', () => {
    const report = buildPerformanceReport({
      userId: 7,
      position: 'Forward',
      matches: [
        {
          id: 1,
          homeUserId: 3,
          awayUserId: 4,
          scoreHome: 2,
          scoreAway: 0,
          status: 'completed',
          matchDate: '2026-09-01',
          tournamentId: 9,
          Tournament: { id: 9, name: 'Liga', season: '2026/2027' },
        },
      ],
      scorers: [{ matchId: 1, userId: 7, goals: 2, assistUserId: null }],
      statRows: [{ matchId: 1, userId: 7, side: 'home', started: true, minutes: 90, goals: 2, assists: 0, shots: 4, shotsOnTarget: 3, rating: 8 }],
      events: [{ matchId: 1, userId: 7, type: 'goal' }, { matchId: 1, userId: 7, type: 'goal' }],
    });

    assert.equal(report.career.goals, 2);
    assert.equal(report.career.appearances, 1);
    assert.equal(report.career.shots, 4);
    assert.equal(report.career.wins, 1);
    assert.equal(report.positionStats.group, 'forward');
    assert.equal(report.positionStats.shotsOnTarget, 3);
    assert.equal(report.positionStats.tackles, undefined);
  });

  it('keeps position slices to fields the match model actually stores', () => {
    const gk = positionSlice('goalkeeper', { appearances: 2, saves: 6, cleanSheets: 1, goals: 0 });
    assert.deepEqual(Object.keys(gk).sort(), ['appearances', 'cleanSheets', 'group', 'saves']);
    const defender = positionSlice('defender', { appearances: 1, cleanSheets: 1, goals: 0, assists: 1 });
    assert.equal(defender.tackles, undefined);
    assert.equal(defender.interceptions, undefined);
  });

  it('splits last-5 form from the rest of the career', () => {
    const matches = [1, 2, 3, 4, 5, 6].map((id) => ({
      id,
      homeUserId: 3,
      awayUserId: 4,
      scoreHome: 1,
      scoreAway: 0,
      status: 'completed',
      matchDate: `2026-09-0${id}`,
      tournamentId: 1,
      Tournament: { id: 1, name: 'Cup', season: '2026/2027' },
    }));
    const statRows = matches.map((match) => ({
      matchId: match.id,
      userId: 7,
      side: 'home',
      started: true,
      minutes: 90,
      goals: 0,
    }));
    const scorers = [{ matchId: 6, userId: 7, goals: 1, assistUserId: null }];
    const report = buildPerformanceReport({
      userId: 7,
      position: 'Midfielder',
      matches,
      statRows,
      scorers,
      events: [],
      now: new Date('2026-10-01'),
    });
    assert.equal(report.career.appearances, 6);
    assert.equal(report.form.last5.appearances, 5);
    assert.equal(report.career.goals, 1);
    assert.equal(report.positionStats.keyPasses, 0);
  });
});

describe('career timeline uses roster matches', () => {
  it('adds goals only for the club the player represented', () => {
    const rows = enrichCareerEntries(
      [
        { club: 'Club A', clubUserId: 10, fromYear: 2024, ongoing: false },
        { club: 'Club B', clubUserId: 11, fromYear: 2026, ongoing: true },
      ],
      {
        memberships: [
          { clubId: 11, clubName: 'Club B', teamType: 'first_team', jerseyNumber: 9, position: 'Forward', joinedAt: '2026-01-01' },
        ],
        lines: [
          { clubUserId: 10, matchDate: '2025-05-01', goals: 1, assists: 0 },
          { clubUserId: 11, matchDate: '2026-09-01', goals: 2, assists: 1 },
        ],
      }
    );
    assert.equal(rows[1].team, 'First Team');
    assert.equal(rows[1].jerseyNumber, 9);
    assert.equal(rows[1].goals, 2);
    assert.equal(rows[1].assists, 1);
    assert.equal(rows[0].goals, 1);
  });
});

describe('profile privacy', () => {
  it('strips email, phone, and private agent data from public responses', () => {
    const response = {
      email: 'player@example.com',
      joncoinBalance: 12,
      dateOfBirth: '2008-01-01',
      city: 'Prishtina',
      contact: { email: 'agent@example.com', phone: '044', instagram: '@player' },
      stats: { agentName: 'Agent X', height: 180 },
      careerHistory: [{ club: 'Club A' }],
      privacy: { email: 'private', phone: 'private', agent: 'private', contact: 'public' },
    };
    applyProfilePrivacy(response, { isOwner: false, isFollower: false, isProfessional: false }, response.privacy);
    assert.equal(response.email, undefined);
    assert.equal(response.joncoinBalance, undefined);
    assert.equal(response.contact.email, undefined);
    assert.equal(response.contact.phone, undefined);
    assert.equal(response.contact.instagram, '@player');
    assert.equal(response.stats.agentName, undefined);
    assert.equal(response.stats.height, 180);
    assert.equal(response.privacy, undefined);
  });

  it('lets followers and scouts see followers-only fields, not private ones', () => {
    assert.equal(canView('followers', { isFollower: true }), true);
    assert.equal(canView('followers', { isProfessional: true }), true);
    assert.equal(canView('private', { isProfessional: true }), false);
    assert.equal(canView('private', { isOwner: true }), true);
  });

  it('rejects a self-assigned verification level', () => {
    const parsed = parsePrivacyInput({ email: 'verified' });
    assert.equal(parsed.ok, false);
  });
});

describe('profile completeness and edits', () => {
  it('calculates completeness from real fields', () => {
    const score = buildCompleteness(
      {
        firstName: 'A',
        lastName: 'B',
        profilePhoto: 'p.jpg',
        country: 'XK',
        position: 'Forward',
        club: 'Club A',
        bio: 'Bio',
        stats: { preferredFoot: 'left', height: 180, weight: 75 },
        careerHistory: [{ club: 'Club A' }],
        achievements: [{ title: 'Cup' }],
      },
      { official: { appearances: 3 }, galleryCount: 1 }
    );
    assert.equal(score.total, 9);
    assert.equal(score.filled, 9);
    assert.equal(score.percent, 100);
  });

  it('does not count a club default cover as the athlete media section', () => {
    const score = buildCompleteness(
      { coverPhoto: 'https://cdn.example/club-cover.jpg', coverPhotoFromClub: true },
      { galleryCount: 0, mediaCount: 0 }
    );
    const media = score.sections.find((section) => section.key === 'media');
    assert.equal(media.filled, false);
  });

  it('drops authoritative match statistics from a profile edit', () => {
    const stats = stripAuthoritativeStats({ height: 180, goals: 40, assists: 10, minutes: 900 });
    assert.deepEqual(stats, { height: 180 });
    const checked = validateFootballStats({ height: 20, preferredFoot: 'both' });
    assert.equal(checked.ok, false);
    assert.equal(checked.field, 'height');
  });

  it('links tournament titles without duplicating a manual award', () => {
    const merged = mergeAchievements(
      [{ title: 'Championship', competition: 'Cup', season: '2026' }],
      [{ title: 'Championship', competition: 'Cup', season: '2026', source: 'tournament' }]
    );
    assert.equal(merged.length, 1);
    const kept = sanitizeAchievements([{ title: '', source: 'tournament' }, { name: 'MVP', season: '2026' }]);
    assert.equal(kept.length, 1);
    assert.equal(kept[0].title, 'MVP');
    assert.equal(kept[0].source, undefined);
  });
});
