const fs = require('fs');
const path = require('path');

const EXT_TO_TYPE = {
  '.jpg': 'image',
  '.jpeg': 'image',
  '.png': 'image',
  '.gif': 'image',
  '.webp': 'image',
  '.mp4': 'video',
  '.mov': 'video',
  '.webm': 'video',
  '.avi': 'video',
  '.mp3': 'audio',
  '.wav': 'audio',
  '.ogg': 'audio',
  '.pdf': 'file',
  '.doc': 'file',
  '.docx': 'file',
};

const EXT_TO_MIME = {
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.gif': ['image/gif'],
  '.webp': ['image/webp'],
  '.mp4': ['video/mp4'],
  '.mov': ['video/quicktime'],
  '.webm': ['video/webm'],
  '.avi': ['video/x-msvideo', 'video/avi'],
  '.mp3': ['audio/mpeg', 'audio/mp3'],
  '.wav': ['audio/wav', 'audio/wave', 'audio/x-wav'],
  '.ogg': ['audio/ogg', 'application/ogg'],
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
};

const BLOCKED_EXT = new Set([
  '.exe', '.bat', '.cmd', '.com', '.msi', '.dll', '.scr', '.ps1', '.sh', '.bash',
  '.js', '.mjs', '.cjs', '.html', '.htm', '.svg', '.php', '.jar', '.apk', '.dmg',
]);

function startsWith(buf, bytes) {
  if (!buf || buf.length < bytes.length) return false;
  for (let i = 0; i < bytes.length; i += 1) {
    if (buf[i] !== bytes[i]) return false;
  }
  return true;
}

function looksLikeMp3(buf) {
  if (startsWith(buf, [0x49, 0x44, 0x33])) return true;
  if (buf.length < 2) return false;
  return buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0;
}

function looksLikeMp4(buf) {
  const slice = buf.subarray(0, Math.min(buf.length, 32)).toString('latin1');
  return slice.includes('ftyp');
}

function signatureOk(ext, buf) {
  if (startsWith(buf, [0x4d, 0x5a]) || startsWith(buf, [0x7f, 0x45, 0x4c, 0x46])) return false;
  if (ext === '.jpg' || ext === '.jpeg') return startsWith(buf, [0xff, 0xd8, 0xff]);
  if (ext === '.png') return startsWith(buf, [0x89, 0x50, 0x4e, 0x47]);
  if (ext === '.gif') return startsWith(buf, [0x47, 0x49, 0x46, 0x38]);
  if (ext === '.webp') {
    return startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && buf.subarray(8, 12).toString('latin1') === 'WEBP';
  }
  if (ext === '.pdf') return buf.subarray(0, 5).toString('latin1') === '%PDF-';
  if (ext === '.doc') return startsWith(buf, [0xd0, 0xcf, 0x11, 0xe0]);
  if (ext === '.docx') return startsWith(buf, [0x50, 0x4b, 0x03, 0x04]);
  if (ext === '.mp4' || ext === '.mov') return looksLikeMp4(buf);
  if (ext === '.webm') return startsWith(buf, [0x1a, 0x45, 0xdf, 0xa3]);
  if (ext === '.avi') {
    return startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && buf.subarray(8, 12).toString('latin1') === 'AVI ';
  }
  if (ext === '.mp3') return looksLikeMp3(buf);
  if (ext === '.wav') {
    return startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && buf.subarray(8, 12).toString('latin1') === 'WAVE';
  }
  if (ext === '.ogg') return startsWith(buf, [0x4f, 0x67, 0x67, 0x53]);
  return false;
}

function readHead(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(64);
    const n = fs.readSync(fd, buf, 0, 64, 0);
    return buf.subarray(0, n);
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Trust neither the client MIME nor the extension alone.
 * @param {{ path?: string, originalname?: string, mimetype?: string }} file
 */
function inspectUploadedFile(file) {
  if (!file?.path) return { ok: false, msg: 'Skedari mungon' };
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!ext || BLOCKED_EXT.has(ext) || !EXT_TO_TYPE[ext]) {
    return { ok: false, msg: 'Ky lloj skedari nuk lejohet' };
  }
  const mime = String(file.mimetype || '').toLowerCase();
  const allowedMimes = EXT_TO_MIME[ext] || [];
  if (!allowedMimes.includes(mime)) {
    return { ok: false, msg: 'Lloji i skedarit nuk përputhet' };
  }
  let head;
  try {
    head = readHead(file.path);
  } catch (_err) {
    return { ok: false, msg: 'Skedari nuk u lexua' };
  }
  if (!head.length || !signatureOk(ext, head)) {
    return { ok: false, msg: 'Përmbajtja e skedarit nuk është e vlefshme' };
  }
  return { ok: true, type: EXT_TO_TYPE[ext], ext };
}

function discardUpload(file) {
  if (!file?.path) return;
  fs.unlink(file.path, () => {});
}

module.exports = {
  EXT_TO_TYPE,
  inspectUploadedFile,
  discardUpload,
  signatureOk,
};
