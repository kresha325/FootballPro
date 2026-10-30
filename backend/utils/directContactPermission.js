'use strict';

/**
 * Enforces the platform's existing mutual block rule before a direct contact
 * action. Database/provider failures deny the action instead of silently
 * treating the relationship as unblocked.
 */
async function checkDirectContact({ actorId, targetId, isEitherBlocked }) {
  const actor = Number(actorId);
  const target = Number(targetId);
  if (!Number.isInteger(actor) || actor <= 0 || !Number.isInteger(target) || target <= 0 || actor === target) {
    return { ok: false, status: 400, code: 'INVALID_PARTICIPANT' };
  }
  if (typeof isEitherBlocked !== 'function') {
    return { ok: false, status: 503, code: 'BLOCK_CHECK_UNAVAILABLE' };
  }
  try {
    if (await isEitherBlocked(actor, target)) {
      return { ok: false, status: 403, code: 'BLOCKED' };
    }
  } catch {
    return { ok: false, status: 503, code: 'BLOCK_CHECK_UNAVAILABLE' };
  }
  return { ok: true };
}

module.exports = { checkDirectContact };
