'use strict';

function uploadByteLimits() {
  const maxImage = parseInt(process.env.UPLOAD_MAX_IMAGE_BYTES || String(10 * 1024 * 1024), 10);
  const maxVideo = parseInt(
    process.env.UPLOAD_MAX_VIDEO_BYTES || process.env.CLOUDINARY_MAX_FILE_SIZE || String(100 * 1024 * 1024),
    10
  );
  const maxAttachment = parseInt(process.env.UPLOAD_MAX_ATTACHMENT_BYTES || String(25 * 1024 * 1024), 10);
  return {
    maxImage,
    maxVideo,
    maxAttachment,
    maxFile: Math.max(maxImage, maxVideo),
  };
}

module.exports = { uploadByteLimits };
