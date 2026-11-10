# XTALENTI upload policy

The API is the enforcement point; browser and mobile limits provide early feedback and must not be treated as a security boundary.

| Use | Accepted types | Maximum |
| --- | --- | ---: |
| Profile photos, logos, post photos, gallery photos, product and sponsor images | JPEG, PNG, GIF, WebP, BMP, HEIC, HEIF | 10 MiB |
| Feed/gallery/video uploads and recorded-stream uploads | MP4, MOV, WebM, AVI, M4V | 100 MiB |
| Direct-message attachment | JPEG, PNG, GIF, WebP; MP4, MOV, WebM, AVI; MP3, WAV, OGG; PDF, DOC, DOCX | 25 MiB |
| Group avatar | JPEG, PNG, GIF, WebP | 5 MiB |

SVG and executable/script formats are rejected. The backend checks extensions and file signatures for image/video uploads; direct-message uploads check the declared MIME, extension, and file signature. A client-supplied MIME value alone is not accepted as proof of file contents.

Backend defaults are centralized in `backend/utils/uploadLimits.js`. Operators may lower or override them with `UPLOAD_MAX_IMAGE_BYTES`, `UPLOAD_MAX_VIDEO_BYTES`, and `UPLOAD_MAX_ATTACHMENT_BYTES`; `CLOUDINARY_MAX_FILE_SIZE` remains a legacy fallback for the video cap. If an override is changed, update the matching web/mobile guidance and verify it against Render's request/body limits before release. No production values were read or changed as part of this work.
