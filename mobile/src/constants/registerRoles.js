/** Mirrors web `Register.jsx` role select (no liga — web has none). */
export const REGISTER_ROLE_OPTIONS = [
  { label: 'Athlete', value: 'athlete' },
  { label: 'Coach', value: 'coach' },
  { label: 'Scout', value: 'scout' },
  { label: 'Manager', value: 'manager' },
  { label: 'Referee', value: 'referee' },
  { label: 'Club', value: 'club' },
  { label: 'Federation', value: 'federation' },
  { label: 'Media', value: 'media' },
  { label: 'Business', value: 'business' },
];

export const REGISTER_ROLE_VALUES = REGISTER_ROLE_OPTIONS.map((o) => o.value);

export function registerRoleLabel(value) {
  const v = String(value || '').toLowerCase();
  return REGISTER_ROLE_OPTIONS.find((o) => o.value === v)?.label || value || 'Athlete';
}
