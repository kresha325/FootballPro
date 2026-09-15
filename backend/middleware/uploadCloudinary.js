const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const cloudinary = require('../utils/cloudinary');

const isCloudinaryEnabled = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

// Multer config: store temporarily in system temp (cloudinary) or in /uploads (local fallback)
const tempDir = os.tmpdir() || '/tmp';
if (!fs.existsSync(tempDir)) {
	try { fs.mkdirSync(tempDir, { recursive: true }); } catch (e) { /* ignore */ }
}
const tempStorage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, tempDir);
	},
	filename: function (req, file, cb) {
		const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
		cb(null, uniqueSuffix + '-' + file.originalname.replace(/\s+/g, '_'));
	}
});

const localStorage = multer.diskStorage({
	destination: function (req, file, cb) {
		const dest = path.join(__dirname, '../uploads');
		if (!fs.existsSync(dest)) {
			fs.mkdirSync(dest, { recursive: true });
		}
		cb(null, dest);
	},
	filename: function (req, file, cb) {
		const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
		cb(null, uniqueSuffix + '-' + file.originalname.replace(/\s+/g, '_'));
	}
});

// Images default 10MB; videos 100MB (same as /api/videos). Multer limit = max of both.
const MAX_IMAGE_SIZE = parseInt(process.env.UPLOAD_MAX_IMAGE_BYTES || '10485760', 10);
const MAX_VIDEO_SIZE = parseInt(
  process.env.UPLOAD_MAX_VIDEO_BYTES || process.env.CLOUDINARY_MAX_FILE_SIZE || String(100 * 1024 * 1024),
  10
);
const MAX_FILE_SIZE = Math.max(MAX_IMAGE_SIZE, MAX_VIDEO_SIZE);

function fileFilter(req, file, cb) {
	if (/^image\//.test(file.mimetype) || /^video\//.test(file.mimetype)) return cb(null, true);
	// React Native / some clients send image/jpg or octet-stream for picked photos
	if (String(file.mimetype || '').toLowerCase() === 'image/jpg') return cb(null, true);
	const ext = path.extname(file.originalname || '').toLowerCase();
	const imageExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif', '.bmp'];
	if (String(file.mimetype || '').toLowerCase() === 'application/octet-stream' && imageExt.includes(ext)) {
		return cb(null, true);
	}
	cb(new Error('Invalid image file'));
}

const upload = multer({ storage: isCloudinaryEnabled ? tempStorage : localStorage, limits: { fileSize: MAX_FILE_SIZE }, fileFilter });

function isVideoFile(file) {
	return /^video\//i.test(file?.mimetype || '') || /\.(mp4|mov|webm|avi|mkv|m4v)$/i.test(file?.originalname || '');
}

// Wrapper for .fields to upload to Cloudinary after multer
function cloudinaryFields(fields) {
	const multerFields = upload.fields(fields);
	return async function (req, res, next) {
		multerFields(req, res, async function (err) {
			if (err) {
				console.error('❌ Multer error:', err && err.message, { code: err && err.code });
				try {
					console.error('Multer request files:', Object.keys(req.files || {}).reduce((acc, k) => {
						acc[k] = (req.files[k] || []).map(f => ({ originalname: f.originalname, mimetype: f.mimetype, size: f.size }));
						return acc;
					}, {}));
				} catch (logErr) {
					console.error('Failed to log multer req.files:', logErr && logErr.message);
				}
				if (err.code === 'LIMIT_FILE_SIZE') {
					return res.status(413).json({
						msg: `Skedari është shumë i madh. Foto max ${Math.round(MAX_IMAGE_SIZE / 1024 / 1024)}MB, video max ${Math.round(MAX_VIDEO_SIZE / 1024 / 1024)}MB.`,
						maxImage: MAX_IMAGE_SIZE,
						maxVideo: MAX_VIDEO_SIZE,
					});
				}
				if (err.message === 'Invalid image file') {
					return res.status(400).json({ msg: 'Invalid image file' });
				}
				return next(err);
			}
			if (!req.files) return next();

			// Enforce per-type caps (multer only has one global limit)
			for (const field of fields) {
				const files = req.files[field.name] || [];
				for (const file of files) {
					const video = isVideoFile(file);
					const cap = video ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
					if (file.size > cap) {
						return res.status(413).json({
							msg: video
								? `Videoja është shumë e madhe. Maksimumi është ${Math.round(MAX_VIDEO_SIZE / 1024 / 1024)}MB.`
								: `Fotoja është shumë e madhe. Maksimumi është ${Math.round(MAX_IMAGE_SIZE / 1024 / 1024)}MB.`,
							max: cap,
						});
					}
				}
			}

			if (!isCloudinaryEnabled) {
				for (const field of fields) {
					const files = req.files[field.name];
					if (files && files.length > 0) {
						for (const file of files) {
							const url = `/uploads/${file.filename}`;
							if (isVideoFile(file)) {
								req.body.video = url;
							} else {
								req.body[field.name] = url;
							}
						}
					}
				}
				return next();
			}
			// For each field, upload to Cloudinary
			for (const field of fields) {
				const files = req.files[field.name];
				if (files && files.length > 0) {
					for (const file of files) {
						try {
							// Determine resource type and folder (by field name OR mimetype —
							// Feed historically sends videos as field "image")
							let resource_type = 'image';
							let folder = 'profile_photos';
							if (field.name === 'coverPhoto') {
								folder = 'cover_photos';
							}
							if (field.name === 'video' || field.name === 'videoFile' || isVideoFile(file)) {
								resource_type = 'video';
								folder = 'videos';
							} else if (field.name === 'image') {
								folder = 'posts';
							} else if (field.name === 'photo') {
								folder = 'stadiums';
							}
								const uploadOptions = {
									resource_type,
									folder,
									transformation: resource_type === 'image'
										? [{ fetch_format: 'auto', quality: 'auto' }]
										: undefined,
								};
								const cloudRes = await cloudinary.uploader.upload(file.path, uploadOptions);
								try {
									const deliveredUrl = resource_type === 'image'
										? cloudinary.url(cloudRes.public_id, {
												secure: true,
												resource_type,
												transformation: [{ fetch_format: 'auto', quality: 'auto' }]
											})
										: cloudRes.secure_url;
									if (resource_type === 'video') {
										req.body.video = deliveredUrl;
									} else {
										req.body[field.name] = deliveredUrl;
									}
								} catch (urlErr) {
									if (resource_type === 'video') {
										req.body.video = cloudRes.secure_url;
									} else {
										req.body[field.name] = cloudRes.secure_url;
									}
								}
								if (process.env.DEBUG_UPLOADS === 'true') {
									console.log(`[${new Date().toISOString()}] Uploaded ${file.originalname} -> ${cloudRes.secure_url} (${resource_type})`, { uploadOptions });
								}
							// Remove local file
							fs.unlink(file.path, () => {});
						} catch (e) {
								console.error('Cloudinary upload error for field', field.name, e && e.message);
								try {
									console.error('File info:', { path: file.path, originalname: file.originalname, mimetype: file.mimetype, size: file.size });
								} catch (fiErr) {
									console.error('Failed to log file info for cloudinary error:', fiErr && fiErr.message);
								}
								console.error(e && e.stack ? e.stack : e);
								const msg = e && e.message ? e.message : 'Upload failed';
								const status = (e && e.http_code) ? e.http_code : 502;
								return res.status(status).json({ msg: msg, field: field.name, error: msg });
						}
					}
				}
			}
			next();
		});
	};
}

module.exports = {
	fields: cloudinaryFields,
	MAX_IMAGE_SIZE,
	MAX_VIDEO_SIZE,
};
