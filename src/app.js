const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const { createSessionMiddleware } = require('./config/session');
const { isProduction, trustProxyHops } = require('./config/env');
const apiRateLimit = require('./middleware/api-rate-limit');
const apiRoutes = require('./routes/api.routes');
const requireDatabase = require('./middleware/require-database');
const { authorizeRoles, requireAuth } = require('./middleware/require-auth');
const { notFoundHandler, errorHandler } = require('./middleware/error-handler');

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  if (isProduction && trustProxyHops > 0) {
    app.set('trust proxy', trustProxyHops);
  }
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'style-src': ["'self'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'img-src': ["'self'", 'data:'],
        'connect-src': ["'self'"],
      },
    },
  }));

  app.use(express.json({ limit: '20kb' }));
  app.use(express.urlencoded({ extended: false, limit: '20kb' }));
  app.use(createSessionMiddleware());
  app.use('/api', apiRateLimit);
  app.use('/api/v1/auth', requireDatabase);
  app.use('/api/v1/workers', requireDatabase);
  app.use('/api/v1/admin', requireDatabase);
  app.use('/api/v1/customer', requireDatabase);
  app.use('/api', apiRoutes);
  app.get('/dashboard-customer.html', requireAuth, authorizeRoles('customer'), (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'dashboard-customer.html'));
  });
  app.get('/dashboard-worker.html', requireAuth, authorizeRoles('worker'), (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'dashboard-worker.html'));
  });
  app.get('/dashboard-admin.html', requireAuth, authorizeRoles('admin'), (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'dashboard-admin.html'));
  });
  app.use(express.static(path.join(__dirname, '..', 'public'), { index: 'index.html' }));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
