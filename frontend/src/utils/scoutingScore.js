export const AGE_GROUP_OPTIONS = [
  { id: 'all', label: 'Të gjitha grupmoshat' },
  { id: 'U13', label: 'U13' },
  { id: 'U15', label: 'U15' },
  { id: 'U17', label: 'U17' },
  { id: 'U19', label: 'U19' },
  { id: 'Senior', label: 'Senior' },
];

export function scoreTone(score) {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 60) return 'text-blue-600 dark:text-blue-400';
  if (score >= 40) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

export function winnerForMetric(metricWinners, key, side) {
  const winner = metricWinners?.[key];
  if (!winner || winner === 'draw') return 'draw';
  return winner === side ? 'win' : 'lose';
}

export function metricLabel(key) {
  if (key === 'goals') return 'Gola';
  if (key === 'assists') return 'Asiste';
  if (key === 'likes') return 'Pëlqime';
  if (key === 'followers') return 'Ndjekës';
  return key;
}

