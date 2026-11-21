const { validationResult } = require('express-validator');

function validateRequest(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  return res.status(400).json({
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Please check the submitted information.',
      details: result.array().map(({ type, path, msg }) => ({ field: path, message: msg, type })),
    },
  });
}

module.exports = validateRequest;
