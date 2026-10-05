const multer = require('multer');
const { IMPORT_LIMITS } = require('../constants');

// Files are held in memory just long enough to validate and send to Cloudinary. Nothing is written to disk.
const single = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMPORT_LIMITS.MAX_FILE_BYTES, files: 1 },
}).single('file');

module.exports = { single };