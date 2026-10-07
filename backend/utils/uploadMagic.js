'use strict';

const fs = require('fs');
const path = require('path');
const FileType = require('file-type');

const MISMATCH = 'Përmbajtja e skedarit nuk përputhet me llojin e lejuar';

/** Detected file-type `ext` -> extensions we accept for that content. */
const EXT_FOR_DETECTED = {
  jpg: ['.jpg', '.jpeg'],
  png: ['.png'],
  gif: ['.gif'],
  webp: ['.webp'],
  bmp: ['.bmp'],
  heic: ['.heic', '.heif'],
  heif: ['.heic', '.heif'],
  mp4: ['.mp4', '.m4v'],
  mov: ['.mov'],
  qt: ['.mov'],
  webm: ['.webm'],
  avi: ['.avi'],
};

function claimedExtension(file) {
  return path.extname(file?.filename || file?.originalname || '').toLowerCase();
}

function collectUploads(req) {
  const files = [];
  if (req?.file) files.push(req.file);
  if (Array.isArray(req?.files)) files.push(...req.files);
  else if (req?.files && typeof req.files === 'object') {
    for (const list of Object.values(req.files)) {
      if (Array.isArray(list)) files.push(...list);
    }
  }
  return files.filter(Boolean);
}

function discardUploads(files) {
  for (const file of files) {
    if (!file?.path) continue;
    try {
      fs.unlinkSync(file.path);
    } catch (err) {
      if (err?.code !== 'ENOENT') {
        fs.unlink(file.path, () => {});
      }
    }
  }
}

async function inspectUpload(file, allowed) {
  const ext = claimedExtension(file);
  if (!ext || (allowed && !allowed.has(ext))) {
    return { ok: false, msg: 'Ky lloj skedari nuk lejohet' };
  }
  let detected = null;
  try {
    if (file?.path) detected = await FileType.fromFile(file.path);
    else if (file?.buffer) detected = await FileType.fromBuffer(file.buffer);
  } catch (_err) {
    return { ok: false, msg: 'Skedari nuk u lexua' };
  }
  const matches = detected && EXT_FOR_DETECTED[detected.ext];
  if (!matches || !matches.includes(ext)) {
    return { ok: false, msg: MISMATCH };
  }
  if (allowed && !matches.some((item) => allowed.has(item))) {
    return { ok: false, msg: 'Ky lloj skedari nuk lejohet' };
  }
  return { ok: true, ext, mime: detected.mime };
}

function guardUploads(middleware, allowed) {
  return (req, res, next) => {
    middleware(req, res, async (err) => {
      if (err) return next(err);
      const files = collectUploads(req);
      try {
        for (const file of files) {
          const magic = await inspectUpload(file, allowed);
          if (!magic.ok) {
            discardUploads(files);
            return res.status(400).json({ msg: magic.msg });
          }
        }
      } catch (checkErr) {
        discardUploads(files);
        return next(checkErr);
      }
      return next();
    });
  };
}

module.exports = {
  MISMATCH,
  collectUploads,
  discardUploads,
  inspectUpload,
  guardUploads,
};
