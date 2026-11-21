const express = require('express');
const { body } = require('express-validator');
const asyncHandler = require('../middleware/async-handler');
const authRateLimit = require('../middleware/auth-rate-limit');
const { csrfProtection, issueCsrfToken } = require('../middleware/csrf-protection');
const { requireAuth } = require('../middleware/require-auth');
const validateRequest = require('../middleware/validate-request');
const { currentUser, login, logout, register } = require('../controllers/auth.controller');

const router = express.Router();

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

function emailValidation() {
  return body('email')
    .isString().withMessage('Enter a valid email address.')
    .bail()
    .trim()
    .isEmail({ allow_utf8_local_part: false }).withMessage('Enter a valid email address.')
    .toLowerCase();
}

router.get('/csrf', issueCsrfToken);

router.post('/register', authRateLimit, csrfProtection, [
  body('fullName').isString().withMessage('Enter your full name.').bail().trim().isLength({ min: 2, max: 100 }).withMessage('Your name must be between 2 and 100 characters.'),
  emailValidation(),
  body('password').isString().withMessage('Enter a password.').bail().isByteLength({ min: 12, max: 72 }).withMessage('Use a password between 12 and 72 bytes.'),
  body('role').isIn(['customer', 'worker']).withMessage('Choose customer or worker registration.'),
  body('location').custom((value, { req }) => {
    if (req.body.role === 'worker' && (typeof value !== 'string' || !value.trim())) return false;
    return value === undefined || (typeof value === 'string' && value.trim().length <= 100);
  }).withMessage('Enter a city of 100 characters or fewer for your worker profile.'),
], validateRequest, asyncHandler(register));

router.post('/login', authRateLimit, csrfProtection, [
  emailValidation(),
  body('password').isString().withMessage('Enter your password.').bail().isByteLength({ min: 1, max: 72 }).withMessage('Password is too long.'),
], validateRequest, asyncHandler(login));

router.get('/me', requireAuth, currentUser);
router.post('/logout', csrfProtection, logout);

module.exports = router;
