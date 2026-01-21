const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cloudinary = require('../utils/cloudinary');

// Multer config: store temporarily in /tmp
const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, '/tmp');
	},
	filename: function (req, file, cb) {
		const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
		cb(null, uniqueSuffix + '-' + file.originalname.replace(/\s+/g, '_'));
	}
});

const upload = multer({ storage: storage });

// Wrapper for .fields to upload to Cloudinary after multer
function cloudinaryFields(fields) {
	const multerFields = upload.fields(fields);
	return async function (req, res, next) {
		multerFields(req, res, async function (err) {
			if (err) return next(err);
			if (!req.files) return next();
			// For each field, upload to Cloudinary
			for (const field of fields) {
				const files = req.files[field.name];
				if (files && files.length > 0) {
					for (const file of files) {
						try {
							const cloudRes = await cloudinary.uploader.upload(file.path, {
								resource_type: 'image',
								folder: field.name === 'coverPhoto' ? 'cover_photos' : 'profile_photos',
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
