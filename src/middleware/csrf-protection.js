const { randomBytes, timingSafeEqual } = require('node:crypto');

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((error) => (error ? reject(error) : resolve()));
  });
}

async function issueCsrfToken(req, res, next) {
  try {
    if (!req.session.csrfToken) {
      req.session.csrfToken = randomBytes(32).toString('base64url');
      await saveSession(req);
    }
    res.json({ data: { csrfToken: req.session.csrfToken } });
  } catch (error) {
    next(error);
  }
}

function csrfProtection(req, res, next) {
  const expectedToken = req.session?.csrfToken;
  const submittedToken = req.get('x-csrf-token');
  if (typeof expectedToken !== 'string' || typeof submittedToken !== 'string') {
    return res.status(403).json({ error: { code: 'CSRF_TOKEN_INVALID', message: 'Refresh the page and try again.' } });
  }

  const expected = Buffer.from(expectedToken);
  const submitted = Buffer.from(submittedToken);
  if (expected.length !== submitted.length || !timingSafeEqual(expected, submitted)) {
    return res.status(403).json({ error: { code: 'CSRF_TOKEN_INVALID', message: 'Refresh the page and try again.' } });
  }
  return next();
}

module.exports = { csrfProtection, issueCsrfToken };
