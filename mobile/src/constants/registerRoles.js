/** Roli i regjistrimit — në përputhje me backend ALLOWED_REGISTER_ROLES */
export const REGISTER_ROLE_OPTIONS = [
  { label: 'Lojtar', value: 'athlete', hint: 'Statistika, video, turne' },
  { label: 'Trajner', value: 'coach', hint: 'Skuadër, plane, ndeshje' },
  { label: 'Skaut', value: 'scout', hint: 'Talente, watchlist' },
  { label: 'Menaxher', value: 'manager', hint: 'Karrierë, kontrata' },
  { label: 'Arbitër', value: 'referee', hint: 'Ndeshje, kampionate' },
  { label: 'Klub', value: 'club', hint: 'Roster, turne, staf' },
  { label: 'Federatë', value: 'federation', hint: 'Organizim zyrtar' },
  { label: 'Media', value: 'media', hint: 'Reportazh, live' },
  { label: 'Biznes', value: 'business', hint: 'Sponsor, shërbime' },
];

export const REGISTER_ROLE_VALUES = REGISTER_ROLE_OPTIONS.map((o) => o.value);

export function registerRoleLabel(value) {
  const v = String(value || '').toLowerCase();
  return REGISTER_ROLE_OPTIONS.find((o) => o.value === v)?.label || value || 'Lojtar';
}
