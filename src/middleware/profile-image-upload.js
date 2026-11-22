const multer = require('multer');

const acceptedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const profileImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: 2 * 1024 * 1024, fields: 0, parts: 1 },
  fileFilter(req, file, callback) {
    if (!acceptedTypes.has(file.mimetype)) {
      const error = new Error('Choose a JPEG, PNG, or WebP image.');
      error.statusCode = 415;
      error.code = 'UNSUPPORTED_PROFILE_IMAGE';
      return callback(error);
    }
    return callback(null, true);
  },
});

function handleProfileImageUploadError(error, req, res, next) {
  if (error instanceof multer.MulterError) {
    return res.status(413).json({ error: { code: error.code, message: 'Choose one image no larger than 2 MB.' } });
  }
  if (error.code === 'UNSUPPORTED_PROFILE_IMAGE') {
    return res.status(415).json({ error: { code: error.code, message: error.message } });
  }
  return next(error);
}

module.exports = { handleProfileImageUploadError, profileImageUpload };
