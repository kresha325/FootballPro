function authorizeGroupAction({
  action,
  actorId,
  actorRole,
  targetId = null,
  targetRole = null,
  ownerId = null,
  isGroup = false,
  adminCount = 0,
}) {
  if (!isGroup) {
    return { ok: false, status: 404, msg: 'Grupi nuk u gjet' };
  }

  const actorIsOwner = ownerId != null && Number(ownerId) === Number(actorId);
  const actorIsAdmin = actorRole === 'admin' || actorIsOwner;
  const actorIsMember = actorRole === 'admin' || actorRole === 'member' || actorIsOwner;

  if (!actorIsMember) {
    return { ok: false, status: 403, msg: 'Nuk je anëtar i këtij grupi' };
  }

  if (action === 'invite') return { ok: true };

  if (action === 'rename' || action === 'avatar') {
    if (!actorIsAdmin) {
      return { ok: false, status: 403, msg: 'Vetëm administratori mund ta ndryshojë grupin' };
    }
    return { ok: true };
  }

  if (action === 'transfer') {
    const canTransfer = actorIsOwner || (ownerId == null && actorRole === 'admin');
    if (!canTransfer) {
      return { ok: false, status: 403, msg: 'Vetëm pronari mund ta transferojë grupin' };
    }
    if (targetId == null || Number(targetId) === Number(actorId)) {
      return { ok: false, status: 400, msg: 'Zgjidh një anëtar tjetër' };
    }
    if (!targetRole) return { ok: false, status: 404, msg: 'Anëtari nuk u gjet' };
    return { ok: true };
  }

  if (action === 'promote') {
    if (!actorIsAdmin) return { ok: false, status: 403, msg: 'Nuk ke leje për këtë veprim' };
    if (targetRole !== 'member') {
      return { ok: false, status: 400, msg: 'Ky përdorues është tashmë administrator' };
    }
    return { ok: true };
  }

  if (action === 'demote') {
    if (!actorIsAdmin) return { ok: false, status: 403, msg: 'Nuk ke leje për këtë veprim' };
    if (targetRole !== 'admin') {
      return { ok: false, status: 400, msg: 'Ky përdorues nuk është administrator' };
    }
    if (ownerId != null && Number(ownerId) === Number(targetId)) {
      return { ok: false, status: 403, msg: 'Pronari nuk mund të ulet. Transfero pronësinë fillimisht' };
    }
    if (Number(adminCount) <= 1) {
      return { ok: false, status: 400, msg: 'Grupi duhet të ketë të paktën një administrator' };
    }
    return { ok: true };
  }

  if (action === 'remove') {
    if (!actorIsAdmin) {
      return { ok: false, status: 403, msg: 'Nuk ke leje për të hequr anëtarë' };
    }
    if (Number(targetId) === Number(actorId)) {
      return { ok: false, status: 400, msg: 'Për të dalë përdor daljen nga grupi' };
    }
    if (ownerId != null && Number(ownerId) === Number(targetId)) {
      return { ok: false, status: 403, msg: 'Pronari nuk mund të hiqet' };
    }
    const targetIsAdmin = targetRole === 'admin';
    const legacyAdmin = ownerId == null && actorRole === 'admin';
    if (targetIsAdmin && !actorIsOwner && !legacyAdmin) {
      return { ok: false, status: 403, msg: 'Vetëm pronari mund të heqë një administrator' };
    }
    return { ok: true };
  }

  return { ok: false, status: 400, msg: 'Veprim i panjohur' };
}

module.exports = { authorizeGroupAction };
