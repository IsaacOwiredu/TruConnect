const express = require('express');
const { authorizeRoles, requireAuth } = require('../middleware/require-auth');
const { listMyReviews } = require('../controllers/customer.controller');

const router = express.Router();
router.use(requireAuth, authorizeRoles('customer'));
router.get('/reviews', listMyReviews);

module.exports = router;
