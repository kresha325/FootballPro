'use strict';

const SQUAD_GROUPS = ['A', 'B', 'C'];

function normalizeSquadGroup(value) {
  const group = String(value || '').trim().toUpperCase();
  return SQUAD_GROUPS.includes(group) ? group : null;
}

function isYouthCategory(category) {
  return String(category || '').trim().toLowerCase().startsWith('u');
}

function squadLabel(category, squadGroup) {
  const cat = String(category || '').trim().toUpperCase();
  const group = normalizeSquadGroup(squadGroup);
  if (!cat || !group) return group || '';
  return `${cat}/${group}`;
}

/**
 * Youth bands must name A, B or C. Other categories clear the group.
 * Returns { ok, msg }.
 */
function assignSquadGroup(membership, rawGroup) {
  const category = String(membership.competitionCategory || '').trim().toLowerCase();
  if (!isYouthCategory(category)) {
    membership.squadGroup = null;
    return { ok: true };
  }
  const group = normalizeSquadGroup(rawGroup !== undefined ? rawGroup : membership.squadGroup);
  if (!group) {
    return { ok: false, msg: 'Për grupmoshat U zgjidh grupin A, B ose C (p.sh. U13/A).' };
  }
  membership.squadGroup = group;
  return { ok: true };
}

module.exports = {
  SQUAD_GROUPS,
  normalizeSquadGroup,
  isYouthCategory,
  squadLabel,
  assignSquadGroup,
};
