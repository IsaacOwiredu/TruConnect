function notFoundHandler(req, res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  const candidateStatus = error.statusCode || error.status;
  let statusCode = Number.isInteger(candidateStatus) && candidateStatus >= 400 && candidateStatus <= 599
    ? candidateStatus
    : 500;
  let code = error.code || (statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_SERVER_ERROR');
  let message = error.message || 'An unexpected server error occurred.';

  if (error.name === 'ValidationError' || error.name === 'CastError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Please check the submitted information.';
  } else if (error.code === 11000) {
    statusCode = 409;
    code = 'DUPLICATE_RESOURCE';
    message = 'A record with those details already exists.';
  } else if (statusCode >= 500 && process.env.NODE_ENV === 'production') {
    message = 'An unexpected server error occurred.';
  }

  if (statusCode >= 500) {
    console.error(error);
  }

  res.status(statusCode).json({
    error: {
      code,
      message,
    },
  });
}

module.exports = { notFoundHandler, errorHandler };
