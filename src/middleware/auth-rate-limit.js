const { rateLimit } = require('express-rate-limit');

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'AUTH_RATE_LIMITED',
      message: 'Too many account requests. Please try again in 15 minutes.',
    },
  },
});

module.exports = authRateLimit;
