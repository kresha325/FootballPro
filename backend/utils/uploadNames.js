const path = require('path');
const fs = require('fs');

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif', '.bmp']);
const VIDEO_EXTS = new Set(['.mp4', '.mov', '.webm', '.avi', '.m4v']);
const MEDIA_EXTS = new Set([...IMAGE_EXTS, ...VIDEO_EXTS]);

const BLOCKED_EXT = new Set([
  '.exe', '.bat', '.cmd', '.com', '.msi', '.dll', '.scr', '.ps1', '.sh', '.bash',
  '.js', '.mjs', '.cjs', '.html', '.htm', '.svg', '.xml', '.php', '.phtml',
  '.jar', '.apk', '.dmg', '.hta',
]);

function safeExtension(originalname, allowed) {
  const base = path.basename(String(originalname || ''));
  if (!base || base.includes('\0') || base.includes('..')) return null;
  const ext = path.extname(base).toLowerCase();
  if (!ext || BLOCKED_EXT.has(ext) || !allowed.has(ext)) return null;
  return ext;
}

function extensionForUpload(file, allowed) {
  const fromName = safeExtension(file?.originalname, allowed);
  if (fromName) return fromName;
  const mime = String(file?.mimetype || '').toLowerCase();
  const mimeMap = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
    'image/heic': '.heic',
    'image/heif': '.heif',
    'video/mp4': '.mp4',
    'video/quicktime': '.mov',
    'video/webm': '.webm',
    'video/x-msvideo': '.avi',
  };
  const mapped = mimeMap[mime];
  if (mapped && allowed.has(mapped)) return mapped;
  return null;
}

function storedFilename(file, allowed) {
  const ext = extensionForUpload(file, allowed);
  if (!ext) return null;
  const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  return `${unique}${ext}`;
}

function startsWith(buf, bytes) {
  if (!buf || buf.length < bytes.length) return false;
  for (let i = 0; i < bytes.length; i += 1) {
    if (buf[i] !== bytes[i]) return false;
  }
  return true;
}

function looksLikeIsoBmff(buf) {
  if (!buf || buf.length < 12) return false;
  return buf.subarray(4, 8).toString('latin1') === 'ftyp';
}

function signatureOk(ext, buf) {
  if (startsWith(buf, [0x4d, 0x5a]) || startsWith(buf, [0x7f, 0x45, 0x4c, 0x46])) return false;
  if (ext === '.jpg' || ext === '.jpeg') return startsWith(buf, [0xff, 0xd8, 0xff]);
  if (ext === '.png') return startsWith(buf, [0x89, 0x50, 0x4e, 0x47]);
  if (ext === '.gif') return startsWith(buf, [0x47, 0x49, 0x46, 0x38]);
  if (ext === '.bmp') return startsWith(buf, [0x42, 0x4d]);
  if (ext === '.webp') {
    return startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && buf.subarray(8, 12).toString('latin1') === 'WEBP';
  }
  if (ext === '.mp4' || ext === '.mov' || ext === '.m4v' || ext === '.heic' || ext === '.heif') {
    return looksLikeIsoBmff(buf);
  }
  if (ext === '.webm') return startsWith(buf, [0x1a, 0x45, 0xdf, 0xa3]);
  if (ext === '.avi') {
    return startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && buf.subarray(8, 12).toString('latin1') === 'AVI ';
  }
  return false;
}

function readHead(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(32);
    const n = fs.readSync(fd, buf, 0, 32, 0);
    return buf.subarray(0, n);
  } finally {
    fs.closeSync(fd);
  }
}

function assertLocalUpload(file, allowed = MEDIA_EXTS) {
  if (!file?.path) return { ok: false, msg: 'Skedari mungon' };
  const ext = path.extname(file.filename || file.originalname || '').toLowerCase();
  if (!ext || BLOCKED_EXT.has(ext) || !allowed.has(ext)) {
    return { ok: false, msg: 'Ky lloj skedari nuk lejohet' };
  }
  let head;
  try {
    head = readHead(file.path);
  } catch (_err) {
    return { ok: false, msg: 'Skedari nuk u lexua' };
  }
  if (!signatureOk(ext, head)) {
    return { ok: false, msg: 'Përmbajtja e skedarit nuk përputhet me llojin e lejuar' };
  }
  return { ok: true, ext };
}

module.exports = {
  IMAGE_EXTS,
  VIDEO_EXTS,
  MEDIA_EXTS,
  BLOCKED_EXT,
  safeExtension,
  extensionForUpload,
  storedFilename,
  signatureOk,
  assertLocalUpload,
};
