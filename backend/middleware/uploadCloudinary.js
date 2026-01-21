const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cloudinary = require('../utils/cloudinary');

const isCloudinaryEnabled = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

// Multer config: store temporarily in /tmp (cloudinary) or in /uploads (local fallback)
const tempStorage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, '/tmp');
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

const upload = multer({ storage: isCloudinaryEnabled ? tempStorage : localStorage });

// Wrapper for .fields to upload to Cloudinary after multer
function cloudinaryFields(fields) {
	const multerFields = upload.fields(fields);
	return async function (req, res, next) {
		multerFields(req, res, async function (err) {
			if (err) return next(err);
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
							return next(e);
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
