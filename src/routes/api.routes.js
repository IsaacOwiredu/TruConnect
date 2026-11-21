const express = require('express');
const healthRoutes = require('./health.routes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/v1/health', healthRoutes);

module.exports = router;
