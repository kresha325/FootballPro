export const UPLOAD_LIMITS = Object.freeze({
  image: 10 * 1024 * 1024,
  video: 100 * 1024 * 1024,
  messageAttachment: 25 * 1024 * 1024,
  groupAvatar: 5 * 1024 * 1024,
});

export const MEDIA_UPLOAD_ACCEPT =
  'image/jpeg,image/png,image/gif,image/webp,image/bmp,image/heic,image/heif,video/mp4,video/quicktime,video/webm,video/x-msvideo,.m4v';

export const MESSAGE_UPLOAD_ACCEPT =
  'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/x-msvideo,video/webm,audio/mpeg,audio/wav,audio/ogg,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
