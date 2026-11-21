const asyncHandler = require('./async-handler');
const { User } = require('../models');

const requireAuth = asyncHandler(async (req, res, next) => {
  const userId = req.session?.userId;
  if (!userId) {
    if (req.method === 'GET' && req.accepts('html') && !req.path.startsWith('/api/')) {
      return res.redirect('/login.html');
    }
    return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Log in to continue.' } });
  }

  const user = await User.findById(userId).select('_id fullName email role accountStatus').exec();
  if (!user || user.accountStatus !== 'active') {
    req.session.destroy(() => {});
    if (req.method === 'GET' && req.accepts('html') && !req.path.startsWith('/api/')) {
      return res.redirect('/login.html');
    }
    return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Log in to continue.' } });
  }

  req.user = user;
  return next();
});

function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      if (req.method === 'GET' && req.accepts('html') && !req.path.startsWith('/api/')) {
        return res.status(403).send('You do not have access to this dashboard.');
      }
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not have permission to perform this action.' } });
    }
    return next();
  };
}

module.exports = { requireAuth, authorizeRoles };
