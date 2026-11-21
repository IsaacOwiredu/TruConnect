const { getDatabaseState } = require('../config/database');

function requireDatabase(req, res, next) {
  if (getDatabaseState() === 'connected') return next();

  const error = new Error('Database is not available. Configure MongoDB and try again.');
  error.statusCode = 503;
  error.code = 'DATABASE_UNAVAILABLE';
  return next(error);
}

module.exports = requireDatabase;
