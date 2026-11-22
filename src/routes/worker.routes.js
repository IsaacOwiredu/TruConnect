const express = require('express');
const { body, param, query } = require('express-validator');
const asyncHandler = require('../middleware/async-handler');
const { authorizeRoles, requireAuth } = require('../middleware/require-auth');
const { csrfProtection } = require('../middleware/csrf-protection');
const validateRequest = require('../middleware/validate-request');
const { getMyProfile, getWorker, getWorkerReviews, listWorkers, submitReview, updateMyProfile, updateMyProfileImage } = require('../controllers/worker.controller');
const { reportWorker } = require('../controllers/report.controller');
const { submitMyVerification } = require('../controllers/verification.controller');
const { handleVerificationUploadError, verificationUpload } = require('../middleware/verification-upload');
const { handleProfileImageUploadError, profileImageUpload } = require('../middleware/profile-image-upload');

const router = express.Router();

router.get('/', [
  query('q').optional().trim().isLength({ max: 80 }),
  query('location').optional().trim().isLength({ max: 100 }),
  query('category').optional().matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  query('verified').optional().isIn(['true', 'false', '1', '0']),
  query('minRating').optional().isFloat({ min: 0, max: 5 }).toFloat(),
  query('sort').optional().isIn(['recommended', 'rating']),
  query('page').optional().isInt({ min: 1, max: 100000 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
], validateRequest, listWorkers);

router.get('/me', requireAuth, authorizeRoles('worker'), getMyProfile);
router.put('/me', requireAuth, authorizeRoles('worker'), csrfProtection, [
  body('categories').optional().isArray({ max: 5 }).withMessage('Choose up to five categories.'),
  body('categories.*').optional().isMongoId().withMessage('A service category is invalid.'),
  body('skills').optional().isArray({ max: 20 }).withMessage('Add up to 20 skills.'),
  body('skills.*').optional().isString().trim().isLength({ min: 1, max: 80 }),
  body('experienceYears').optional().isInt({ min: 0, max: 80 }).toInt(),
  body('description').optional().isString().trim().isLength({ max: 2000 }),
  body('location').optional().isObject(),
  body('location.city').optional().isString().trim().isLength({ max: 100 }),
  body('location.region').optional().isString().trim().isLength({ max: 100 }),
  body('phone').optional({ values: 'falsy' }).matches(/^[+0-9\s().-]{7,30}$/).withMessage('Enter a valid phone number.'),
  body('whatsapp').optional({ values: 'falsy' }).matches(/^[+0-9\s().-]{7,30}$/).withMessage('Enter a valid WhatsApp number.'),
  body('availability').optional().isIn(['available', 'unavailable']),
], validateRequest, asyncHandler(updateMyProfile));
router.post('/me/profile-image', requireAuth, authorizeRoles('worker'), csrfProtection, profileImageUpload.single('profileImage'), handleProfileImageUploadError, asyncHandler(updateMyProfileImage));
router.post('/me/verification', requireAuth, authorizeRoles('worker'), csrfProtection, verificationUpload.array('documents', 4), handleVerificationUploadError, [
  body('evidenceSummary').optional().isString().trim().isLength({ max: 1500 }),
], validateRequest, submitMyVerification);

router.get('/:id/reviews', [
  param('id').isMongoId(),
  query('page').optional().isInt({ min: 1, max: 100000 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
], validateRequest, getWorkerReviews);

router.post('/:id/reviews', requireAuth, authorizeRoles('customer'), csrfProtection, [
  param('id').isMongoId(),
  body('rating').isInt({ min: 1, max: 5 }).toInt(),
  body('body').isString().trim().isLength({ min: 5, max: 2000 }),
], validateRequest, submitReview);

router.post('/:id/reports', requireAuth, authorizeRoles('customer'), csrfProtection, [
  param('id').isMongoId(),
  body('reason').isIn(['misrepresentation', 'conduct', 'spam', 'safety', 'other']),
  body('details').isString().trim().isLength({ min: 10, max: 2000 }),
], validateRequest, asyncHandler(reportWorker));

router.get('/:id', [param('id').isMongoId()], validateRequest, getWorker);

module.exports = router;
