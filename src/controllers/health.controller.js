function getHealth(req, res) {
  res.json({
    status: 'ok',
    service: 'TruConnect API',
    timestamp: new Date().toISOString(),
  });
}

module.exports = { getHealth };
