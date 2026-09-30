'use strict';

/** Allowed Pro profile accent themes (stored on Profile.profileTheme). */
const PROFILE_THEMES = {
  default: { id: 'default', label: 'Standarde' },
  gold: { id: 'gold', label: 'Gold' },
  midnight: { id: 'midnight', label: 'Midnight' },
  forest: { id: 'forest', label: 'Forest' },
  crimson: { id: 'crimson', label: 'Crimson' },
  ocean: { id: 'ocean', label: 'Ocean' },
};

const THEME_IDS = Object.keys(PROFILE_THEMES);

function normalizeProfileTheme(raw) {
  const id = String(raw || 'default').trim().toLowerCase();
  return THEME_IDS.includes(id) ? id : null;
}

module.exports = {
  PROFILE_THEMES,
  THEME_IDS,
  normalizeProfileTheme,
};
