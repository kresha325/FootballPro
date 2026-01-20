const multer = require('multer');
const path = require('path');

const fs = require('fs');
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Merr path absolut për uploads brenda backend/uploads/
    const backendUploads = path.join(__dirname, '../uploads');
      let dest = backendUploads; // Use uploads folder directly
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
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

const uploadLocal = multer({ storage: storage });

module.exports = uploadLocal;
