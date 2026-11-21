require('dotenv').config();
const crypto = require('node:crypto');

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be a whole number between 1 and 65535.');
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const mongoUri = (process.env.MONGODB_URI || '').trim();
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
const configuredSessionSecret = process.env.SESSION_SECRET || '';

if (isProduction && !mongoUri) {
  throw new Error('MONGODB_URI must be configured in production.');
}
if (isProduction && !configuredSessionSecret) {
  throw new Error('SESSION_SECRET must be configured in production.');
}
if (configuredSessionSecret && Buffer.byteLength(configuredSessionSecret) < 32) {
  throw new Error('SESSION_SECRET must be at least 32 bytes long.');
}
if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0) {
  throw new Error('TRUST_PROXY_HOPS must be a whole number greater than or equal to 0.');
}

module.exports = Object.freeze({
  nodeEnv,
  port,
  isProduction,
  mongoUri,
  trustProxyHops,
  sessionSecret: configuredSessionSecret || crypto.randomBytes(32).toString('hex'),
});
