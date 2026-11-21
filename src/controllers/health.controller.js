const { getDatabaseState } = require('../config/database');

function getHealth(req, res) {
  res.json({
    status: 'ok',
    service: 'TruConnect API',
    database: getDatabaseState(),
    timestamp: new Date().toISOString(),
  });
}

function getReadiness(req, res) {
  const database = getDatabaseState();
  const ready = database === 'connected';

  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    service: 'TruConnect API',
    database,
  });
}

module.exports = { getHealth, getReadiness };
