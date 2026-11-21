require('dotenv').config();

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be a whole number between 1 and 65535.');
}

module.exports = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  port,
  isProduction: process.env.NODE_ENV === 'production',
  mongoUri: (process.env.MONGODB_URI || '').trim(),
});
