const express = require('express');
const { body, param, query } = require('express-validator');
const { authorizeRoles, requireAuth } = require('../middleware/require-auth');
const { csrfProtection } = require('../middleware/csrf-protection');
const validateRequest = require('../middleware/validate-request');
const asyncHandler = require('../middleware/async-handler');
const {
  createCategory,
  downloadVerificationDocument,
  getActivity,
  getCategories,
  getMetrics,
  listReports,
  listReviews,
  listUsers,
  listVerificationRequests,
  moderateReview,
  reviewVerification,
  setUserStatus,
  updateCategory,
  updateReport,
} = require('../controllers/admin.controller');

const router = express.Router();
router.use(requireAuth, authorizeRoles('admin'));

const pageQuery = [
  query('page').optional().isInt({ min: 1, max: 100000 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];

router.get('/metrics', asyncHandler(getMetrics));
router.get('/activity', asyncHandler(getActivity));
router.get('/users', [
  ...pageQuery,
  query('role').optional().isIn(['customer', 'worker', 'admin']),
  query('status').optional().isIn(['active', 'suspended']),
  query('q').optional().trim().isLength({ max: 80 }),
], validateRequest, asyncHandler(listUsers));
router.patch('/users/:id/status', csrfProtection, [
  param('id').isMongoId(),
  body('accountStatus').isIn(['active', 'suspended']),
], validateRequest, asyncHandler(setUserStatus));

router.get('/verification-requests', [
  query('status').optional().isIn(['pending', 'approved', 'rejected']),
], validateRequest, asyncHandler(listVerificationRequests));
router.get('/verification-requests/:id/documents/:storageKey', [
  param('id').isMongoId(),
  param('storageKey').matches(/^[a-f0-9-]{36}\.(pdf|jpg|png|webp)$/),
], validateRequest, asyncHandler(downloadVerificationDocument));
router.patch('/verification-requests/:id', csrfProtection, [
  param('id').isMongoId(),
  body('status').isIn(['approved', 'rejected']),
  body('reviewNote').optional().isString().trim().isLength({ max: 1000 }),
], validateRequest, asyncHandler(reviewVerification));

router.get('/reviews', [query('status').optional().isIn(['pending', 'approved', 'rejected', 'hidden'])], validateRequest, asyncHandler(listReviews));
router.patch('/reviews/:id', csrfProtection, [
  param('id').isMongoId(),
  body('moderationStatus').isIn(['approved', 'rejected', 'hidden']),
], validateRequest, asyncHandler(moderateReview));

router.get('/reports', [query('status').optional().isIn(['open', 'reviewing', 'resolved', 'dismissed'])], validateRequest, asyncHandler(listReports));
router.patch('/reports/:id', csrfProtection, [
  param('id').isMongoId(),
  body('status').isIn(['reviewing', 'resolved', 'dismissed']),
  body('resolutionNote').optional().isString().trim().isLength({ max: 1000 }),
], validateRequest, asyncHandler(updateReport));

router.get('/categories', asyncHandler(getCategories));
router.post('/categories', csrfProtection, [
  body('name').isString().trim().isLength({ min: 2, max: 80 }),
  body('slug').isString().trim().matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  body('description').optional().isString().trim().isLength({ max: 500 }),
  body('icon').optional().isString().trim().isLength({ max: 60 }),
  body('sortOrder').optional().isInt({ min: 0, max: 10000 }).toInt(),
], validateRequest, asyncHandler(createCategory));
router.patch('/categories/:id', csrfProtection, [
  param('id').isMongoId(),
  body('name').optional().isString().trim().isLength({ min: 2, max: 80 }),
  body('slug').optional().isString().trim().matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  body('description').optional().isString().trim().isLength({ max: 500 }),
  body('icon').optional().isString().trim().isLength({ max: 60 }),
  body('sortOrder').optional().isInt({ min: 0, max: 10000 }).toInt(),
  body('isActive').optional().isBoolean().toBoolean(),
], validateRequest, asyncHandler(updateCategory));

module.exports = router;
