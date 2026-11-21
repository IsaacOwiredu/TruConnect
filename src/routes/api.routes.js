const express = require('express');
const healthRoutes = require('./health.routes');
const categoryRoutes = require('./category.routes');
const authRoutes = require('./auth.routes');
const workerRoutes = require('./worker.routes');
const adminRoutes = require('./admin.routes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/v1/health', healthRoutes);
router.use('/v1/categories', categoryRoutes);
router.use('/v1/auth', authRoutes);
router.use('/v1/workers', workerRoutes);
router.use('/v1/admin', adminRoutes);

module.exports = router;
