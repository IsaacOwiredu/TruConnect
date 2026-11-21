const express = require('express');
const healthRoutes = require('./health.routes');
const categoryRoutes = require('./category.routes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/v1/health', healthRoutes);
router.use('/v1/categories', categoryRoutes);

module.exports = router;
