const SEASON_START_MONTH = 7;

function parseDateInput(value) {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function footballSeasonFromDate(dateInput) {
  const d = parseDateInput(dateInput);
  if (!d) return null;
  const year = d.getFullYear();
  const month = d.getMonth();
  if (month >= SEASON_START_MONTH) return `${year}/${year + 1}`;
  return `${year - 1}/${year}`;
}

export function calendarEditionFromDate(dateInput) {
  const d = parseDateInput(dateInput);
  if (!d) return null;
  return String(d.getFullYear());
}

export function previewTournamentSeason(type, startDate) {
  const ref = parseDateInput(startDate) || new Date();
  if (type === 'league') return footballSeasonFromDate(ref);
  return calendarEditionFromDate(ref);
}

export function formatTournamentTitle(tournament) {
  const name = tournament?.name || 'Turneu';
  const season = tournament?.season;
  if (!season) return name;
  if (tournament?.type === 'league') return `${name} ${season}`;
  return `${name} (${season})`;
}

export function seasonLabel(type) {
  return type === 'league' ? 'Sezoni (FIFA)' : 'Edicioni (viti)';
}

export function todayDateInputValue() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
