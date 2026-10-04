const MAX_MESSAGE_LENGTH = 4000;

function normalizeMessageText(value) {
  if (value == null) return '';
  return String(value).replace(/\u0000/g, '');
}

/**
 * Text rules for send/edit. Empty is allowed only when a file is attached.
 */
function validateMessageText(value, { allowEmpty = false } = {}) {
  const text = normalizeMessageText(value);
  if (!allowEmpty && !text.trim()) {
    return { ok: false, status: 400, msg: 'Mesazhi nuk mund të jetë bosh' };
  }
  if (text.length > MAX_MESSAGE_LENGTH) {
    return {
      ok: false,
      status: 400,
      msg: `Mesazhi është shumë i gjatë (maksimumi ${MAX_MESSAGE_LENGTH} karaktere)`,
    };
  }
  return { ok: true, text };
}

function escapeLike(value) {
  return String(value || '').replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function safeDisplayFileName(name) {
  const base = pathBasename(String(name || 'file'));
  const cleaned = base.replace(/[^\w.\- ()\u00C0-\u024F]+/g, '_').slice(0, 180);
  return cleaned || 'file';
}

function pathBasename(name) {
  const normalized = String(name || '').replace(/\\/g, '/');
  const parts = normalized.split('/');
  return parts[parts.length - 1] || 'file';
}

module.exports = {
  MAX_MESSAGE_LENGTH,
  normalizeMessageText,
  validateMessageText,
  escapeLike,
  safeDisplayFileName,
};
