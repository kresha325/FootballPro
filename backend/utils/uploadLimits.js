'use strict';

function uploadByteLimits() {
  const maxImage = parseInt(process.env.UPLOAD_MAX_IMAGE_BYTES || String(8 * 1024 * 1024), 10);
  const maxVideo = parseInt(
    process.env.UPLOAD_MAX_VIDEO_BYTES || process.env.CLOUDINARY_MAX_FILE_SIZE || String(100 * 1024 * 1024),
    10
  );
  return {
    maxImage,
    maxVideo,
    maxFile: Math.max(maxImage, maxVideo),
  };
}

module.exports = { uploadByteLimits };
