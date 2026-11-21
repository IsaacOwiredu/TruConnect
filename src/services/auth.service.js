const { randomBytes } = require('node:crypto');

function sessionRegenerate(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });
}

function sessionSave(req) {
  return new Promise((resolve, reject) => {
    req.session.save((error) => (error ? reject(error) : resolve()));
  });
}

async function startAuthenticatedSession(req, userId) {
  await sessionRegenerate(req);
  req.session.userId = String(userId);
  req.session.csrfToken = randomBytes(32).toString('base64url');
  await sessionSave(req);
  return req.session.csrfToken;
}

function publicUser(user) {
  return {
    id: String(user._id),
    fullName: user.fullName,
    email: user.email,
    role: user.role,
  };
}

module.exports = { publicUser, startAuthenticatedSession };
