const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { IMAGE_EXTS } = require('../utils/uploadNames');
const { inspectUpload, discardUploads, MISMATCH } = require('../utils/uploadMagic');
const { uploadByteLimits } = require('../utils/uploadLimits');

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

function writeTemp(name, body) {
  const filePath = path.join(os.tmpdir(), `upload-magic-${Date.now()}-${name}`);
  fs.writeFileSync(filePath, body);
  return { path: filePath, originalname: name, filename: name, size: body.length };
}

describe('upload magic bytes', () => {
  it('accepts a real PNG and rejects HTML or SVG renamed as an image', async () => {
    const png = writeTemp('pixel.png', PNG);
    const html = writeTemp('page.png', Buffer.from('<html><script>alert(1)</script></html>'));
    const svg = writeTemp('icon.svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'));
    const svgAsPng = writeTemp('icon.png', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'));
    try {
      const ok = await inspectUpload(png, IMAGE_EXTS);
      assert.equal(ok.ok, true);
      assert.equal(ok.mime, 'image/png');

      const htmlResult = await inspectUpload(html, IMAGE_EXTS);
      assert.equal(htmlResult.ok, false);
      assert.equal(htmlResult.msg, MISMATCH);

      const svgResult = await inspectUpload(svg, IMAGE_EXTS);
      assert.equal(svgResult.ok, false);

      const svgPngResult = await inspectUpload(svgAsPng, IMAGE_EXTS);
      assert.equal(svgPngResult.ok, false);
      assert.equal(svgPngResult.msg, MISMATCH);
    } finally {
      discardUploads([png, html, svg, svgAsPng]);
    }
    assert.equal(fs.existsSync(html.path), false);
  });

  it('defaults images to 8MB and videos to 100MB unless the env overrides them', () => {
    const prevImage = process.env.UPLOAD_MAX_IMAGE_BYTES;
    const prevVideo = process.env.UPLOAD_MAX_VIDEO_BYTES;
    const prevCloud = process.env.CLOUDINARY_MAX_FILE_SIZE;
    delete process.env.UPLOAD_MAX_IMAGE_BYTES;
    delete process.env.UPLOAD_MAX_VIDEO_BYTES;
    delete process.env.CLOUDINARY_MAX_FILE_SIZE;
    try {
      const limits = uploadByteLimits();
      assert.equal(limits.maxImage, 8 * 1024 * 1024);
      assert.equal(limits.maxVideo, 100 * 1024 * 1024);
    } finally {
      if (prevImage == null) delete process.env.UPLOAD_MAX_IMAGE_BYTES;
      else process.env.UPLOAD_MAX_IMAGE_BYTES = prevImage;
      if (prevVideo == null) delete process.env.UPLOAD_MAX_VIDEO_BYTES;
      else process.env.UPLOAD_MAX_VIDEO_BYTES = prevVideo;
      if (prevCloud == null) delete process.env.CLOUDINARY_MAX_FILE_SIZE;
      else process.env.CLOUDINARY_MAX_FILE_SIZE = prevCloud;
    }
  });
});
