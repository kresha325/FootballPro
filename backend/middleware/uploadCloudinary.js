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

// Allow configurable max file size; default to 10MB to match Cloudinary limits
const MAX_FILE_SIZE = parseInt(process.env.CLOUDINARY_MAX_FILE_SIZE || '10485760', 10);

function fileFilter(req, file, cb) {
	if (/^image\//.test(file.mimetype) || /^video\//.test(file.mimetype)) return cb(null, true);
	cb(new Error('Invalid image file'));
}

const upload = multer({ storage: isCloudinaryEnabled ? tempStorage : localStorage, limits: { fileSize: MAX_FILE_SIZE }, fileFilter });

// Wrapper for .fields to upload to Cloudinary after multer
function cloudinaryFields(fields) {
	const multerFields = upload.fields(fields);
	return async function (req, res, next) {
		multerFields(req, res, async function (err) {
			if (err) {
				console.error('❌ Multer error:', err && err.message);
				if (err.code === 'LIMIT_FILE_SIZE') {
					return res.status(413).json({ msg: 'File too large', max: MAX_FILE_SIZE });
				}
				if (err.message === 'Invalid image file') {
					return res.status(400).json({ msg: 'Invalid image file' });
				}
				return next(err);
			}
			if (!req.files) return next();
			if (!isCloudinaryEnabled) {
				for (const field of fields) {
					const files = req.files[field.name];
					if (files && files.length > 0) {
						for (const file of files) {
							req.body[field.name] = `/uploads/${file.filename}`;
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
							// Determine resource type and folder
							let resource_type = 'image';
							let folder = 'profile_photos';
							if (field.name === 'coverPhoto') {
								folder = 'cover_photos';
							}
							if (field.name === 'video' || field.name === 'videoFile') {
								resource_type = 'video';
								folder = 'videos';
							}
							const cloudRes = await cloudinary.uploader.upload(file.path, {
								resource_type,
								folder,
							});
							// Attach cloudinary url to req.body for controller
							req.body[field.name] = cloudRes.secure_url;
							// Remove local file
							fs.unlink(file.path, () => {});
						} catch (e) {
							console.error('Cloudinary upload error for field', field.name, e && e.message);
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
	fields: cloudinaryFields
};
