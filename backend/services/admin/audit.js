'use strict';

async function writeAudit(entry) {
  try {
    const AdminAuditLog = require('../../models/AdminAuditLog');
    await AdminAuditLog.create({
      adminId: Number(entry.adminId),
      action: String(entry.action || 'ADMIN_ACTION').slice(0, 64),
      entity: String(entry.entity || 'unknown').slice(0, 64),
      entityId: entry.entityId == null ? null : String(entry.entityId).slice(0, 64),
      result: String(entry.result || 'success').slice(0, 32),
      reason: entry.reason ? String(entry.reason).slice(0, 500) : null,
      metadata: entry.metadata && typeof entry.metadata === 'object' ? entry.metadata : null,
    });
  } catch (err) {
    console.warn('audit log skipped:', err?.message || err);
  }
}

module.exports = { writeAudit };
