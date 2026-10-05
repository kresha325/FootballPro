'use strict';

const { buildPerformanceReport } = require('../../utils/playerProfileCv');

function filterLines(lines, filters = {}) {
  const season = filters.season ? String(filters.season) : null;
  const competitionId = filters.competitionId != null && filters.competitionId !== '' ? Number(filters.competitionId) : null;
  const clubId = filters.clubId != null && filters.clubId !== '' ? Number(filters.clubId) : null;
  const from = filters.from ? new Date(filters.from) : null;
  const to = filters.to ? new Date(filters.to) : null;
  return (lines || []).filter((line) => {
    if (season && String(line.season || '') !== season) return false;
    if (competitionId && Number(line.tournamentId) !== competitionId) return false;
    if (clubId && Number(line.clubUserId) !== clubId) return false;
    if (from || to) {
      const date = line.matchDate ? new Date(line.matchDate) : null;
      if (!date || Number.isNaN(date.getTime())) return false;
      if (from && date < from) return false;
      if (to && date > to) return false;
    }
    return true;
  });
}

function bundleForLines(bundle, lines) {
  const ids = new Set(lines.map((line) => Number(line.matchId)));
  const keep = (row) => ids.has(Number(row.matchId));
  return {
    statRows: (bundle.statRows || []).filter(keep),
    scorers: (bundle.scorers || []).filter(keep),
    events: (bundle.events || []).filter(keep),
    matches: (bundle.matches || []).filter((row) => ids.has(Number(row.id))),
  };
}

function monthKey(date) {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return null;
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  return `${value.getUTCFullYear()}-${month}`;
}

function trendFromLines(lines) {
  const points = (lines || [])
    .slice()
    .sort((a, b) => new Date(a.matchDate || 0) - new Date(b.matchDate || 0))
    .map((line) => ({
      matchId: line.matchId,
      date: line.matchDate,
      competition: line.competition,
      season: line.season,
      goals: Number(line.goals) || 0,
      assists: Number(line.assists) || 0,
      minutes: Number(line.minutes) || 0,
      rating: line.rating == null || Number.isNaN(Number(line.rating)) ? null : Number(line.rating),
      result: line.result,
    }));
  const monthlyMap = new Map();
  for (const point of points) {
    const key = monthKey(point.date) || 'unknown';
    if (!monthlyMap.has(key)) {
      monthlyMap.set(key, { month: key, appearances: 0, goals: 0, assists: 0, minutes: 0, ratingSum: 0, ratingCount: 0 });
    }
    const row = monthlyMap.get(key);
    row.appearances += 1;
    row.goals += point.goals;
    row.assists += point.assists;
    row.minutes += point.minutes;
    if (point.rating != null) {
      row.ratingSum += point.rating;
      row.ratingCount += 1;
    }
  }
  const monthly = [...monthlyMap.values()].map((row) => ({
    month: row.month,
    appearances: row.appearances,
    goals: row.goals,
    assists: row.assists,
    minutes: row.minutes,
    rating: row.ratingCount ? Math.round((row.ratingSum / row.ratingCount) * 10) / 10 : null,
  }));
  const sufficient = points.length >= 2;
  return {
    sufficient,
    emptyReason: points.length === 0 ? 'no_matches' : sufficient ? null : 'insufficient_data',
    points,
    monthly,
  };
}

function catalogFromLines(lines) {
  const seasons = new Set();
  const competitions = new Map();
  const clubs = new Set();
  for (const line of lines || []) {
    if (line.season) seasons.add(String(line.season));
    if (line.tournamentId) {
      competitions.set(Number(line.tournamentId), line.competition || `Competition ${line.tournamentId}`);
    }
    if (line.clubUserId) clubs.add(Number(line.clubUserId));
  }
  return {
    seasons: [...seasons].sort(),
    competitions: [...competitions.entries()].map(([id, name]) => ({ id, name })),
    clubs: [...clubs],
  };
}

/**
 * Career totals always come from the full match bundle.
 * Window totals use the same report builder on the filtered matches,
 * so goals, assists, minutes, and appearances cannot diverge from the profile.
 */
function projectPerformance(bundle, userId, position, filters = {}) {
  const full = buildPerformanceReport({ userId, position, ...bundle });
  const filteredLines = filterLines(full.lines, filters);
  const filtered = buildPerformanceReport({
    userId,
    position,
    ...bundleForLines(bundle, filteredLines),
  });
  return {
    hasOfficial: full.hasOfficial,
    source: full.source,
    unsupported: full.unsupported,
    career: full.career,
    window: filtered.career,
    competitions: filtered.competitions,
    form: filtered.form,
    trends: trendFromLines(filtered.lines),
    filters: catalogFromLines(full.lines),
  };
}

module.exports = {
  filterLines,
  bundleForLines,
  trendFromLines,
  catalogFromLines,
  projectPerformance,
};
