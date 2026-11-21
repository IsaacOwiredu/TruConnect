const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const apiRateLimit = require('./middleware/api-rate-limit');
const apiRoutes = require('./routes/api.routes');
const { notFoundHandler, errorHandler } = require('./middleware/error-handler');

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        styleSrc: ["'self'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
      },
    },
  }));

  app.use(express.json({ limit: '20kb' }));
  app.use(express.urlencoded({ extended: false, limit: '20kb' }));
  app.use('/api', apiRateLimit);
  app.use('/api', apiRoutes);
  app.use(express.static(path.join(__dirname, '..', 'public'), { index: 'index.html' }));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
