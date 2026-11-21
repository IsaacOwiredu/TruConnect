const multer = require('multer');

const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

const verificationUpload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 4, fileSize: 5 * 1024 * 1024, fields: 1, fieldSize: 1500, parts: 5 },
  fileFilter(req, file, callback) {
    if (!allowedTypes.has(file.mimetype)) {
      const error = new Error('Upload a PDF, JPEG, PNG, or WebP document.');
      error.statusCode = 415;
      error.code = 'UNSUPPORTED_UPLOAD_TYPE';
      return callback(error);
    }
    return callback(null, true);
  },
});

function handleVerificationUploadError(error, req, res, next) {
  if (error instanceof multer.MulterError) {
    const tooLarge = error.code === 'LIMIT_FILE_SIZE' || error.code === 'LIMIT_FILE_COUNT';
    return res.status(tooLarge ? 413 : 400).json({
      error: {
        code: error.code,
        message: tooLarge ? 'Upload no more than four files, each up to 5 MB.' : 'The uploaded form could not be processed.',
      },
    });
  }
  if (error.code === 'UNSUPPORTED_UPLOAD_TYPE') {
    return res.status(415).json({ error: { code: error.code, message: error.message } });
  }
  return next(error);
}

module.exports = { handleVerificationUploadError, verificationUpload };
