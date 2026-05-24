/** European/FIFA season starts in August (month index 7). */
const SEASON_START_MONTH = 7;

function parseDateInput(value) {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/** Aug–Dec → YYYY/(Y+1); Jan–Jul → (Y-1)/Y */
function footballSeasonFromDate(dateInput) {
  const d = parseDateInput(dateInput);
  if (!d) return null;
  const year = d.getFullYear();
  const month = d.getMonth();
  if (month >= SEASON_START_MONTH) return `${year}/${year + 1}`;
  return `${year - 1}/${year}`;
}

/** Single-year edition for cups / knockout events. */
function calendarEditionFromDate(dateInput) {
  const d = parseDateInput(dateInput);
  if (!d) return null;
  return String(d.getFullYear());
}

function isValidLeagueSeason(value) {
  const m = String(value || '').trim().match(/^(\d{4})\/(\d{4})$/);
  if (!m) return false;
  return Number(m[2]) === Number(m[1]) + 1;
}

/**
 * Resolve stored season for a tournament.
 * - league: FIFA format YYYY/(Y+1), required
 * - cup/knockout: calendar year of start (e.g. 2026)
 */
function resolveTournamentSeason({ type, startDate, season }) {
  const manual = String(season || '').trim();
  if (manual) {
    if (type === 'league' && !isValidLeagueSeason(manual)) {
      throw new Error('Invalid league season. Use format YYYY/YYYY+1 (e.g. 2026/2027).');
    }
    return manual;
  }

  const ref = parseDateInput(startDate) || new Date();
  if (type === 'league') return footballSeasonFromDate(ref);
  return calendarEditionFromDate(ref);
}

function formatTournamentTitle(tournament) {
  const name = tournament?.name || 'Turneu';
  const season = tournament?.season;
  if (!season) return name;
  if (tournament?.type === 'league') return `${name} ${season}`;
  return `${name} (${season})`;
}

module.exports = {
  footballSeasonFromDate,
  calendarEditionFromDate,
  isValidLeagueSeason,
  resolveTournamentSeason,
  formatTournamentTitle,
};
