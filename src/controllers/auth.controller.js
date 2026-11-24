const bcrypt = require('bcrypt');
const { createHash, randomBytes } = require('node:crypto');
const { User, Worker } = require('../models');
const { publicUser, startAuthenticatedSession } = require('../services/auth.service');
const { isEmailConfigured, sendEmailVerificationEmail, sendPasswordResetEmail } = require('../services/email.service');

const BCRYPT_COST = 12;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const DUMMY_PASSWORD_HASH = bcrypt.hash('not-a-real-truconnect-account-password', BCRYPT_COST);

async function register(req, res) {
  if (!isEmailConfigured()) {
    return res.status(503).json({ error: { code: 'EMAIL_VERIFICATION_UNAVAILABLE', message: 'Account registration requires email delivery to be configured.' } });
  }
  const fullName = req.body.fullName.trim();
  const email = req.body.email.trim().toLowerCase();
  const role = req.body.role;
  const existingUser = await User.exists({ email });
  if (existingUser) {
    return res.status(409).json({ error: { code: 'EMAIL_ALREADY_REGISTERED', message: 'An account already exists for that email address. Log in or use a different email.' } });
  }
  const passwordHash = await bcrypt.hash(req.body.password, BCRYPT_COST);

  const user = await User.create({ fullName, email, passwordHash, role, emailVerified: false });
  if (role === 'worker') {
    try {
      await Worker.create({
        user: user._id,
        location: { city: (req.body.location || '').trim() },
        verificationStatus: 'unverified',
      });
    } catch (error) {
      await User.deleteOne({ _id: user._id });
      throw error;
    }
  }

  if (isEmailConfigured()) {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    user.emailVerificationTokenHash = tokenHash;
    user.emailVerificationExpiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);
    await user.save();
    try {
      await sendEmailVerificationEmail(email, token);
    } catch (error) {
      console.error('Email verification delivery failed:', error.message);
      if (role === 'worker') await Worker.deleteOne({ user: user._id });
      await User.deleteOne({ _id: user._id });
      return res.status(503).json({ error: { code: 'EMAIL_DELIVERY_FAILED', message: 'We could not send the confirmation email. Please try registering again later.' } });
    }
  }

  return res.status(201).json({ data: { message: 'Your account was created. Check your email for a confirmation link before logging in.' } });
}

async function login(req, res) {
  const email = req.body.email.trim().toLowerCase();
  const user = await User.findOne({ email }).select('+passwordHash').exec();
  const comparisonHash = user ? user.passwordHash : await DUMMY_PASSWORD_HASH;
  const passwordMatches = await bcrypt.compare(req.body.password, comparisonHash);

  if (!user || !passwordMatches || user.accountStatus !== 'active') {
    return res.status(401).json({
      error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' },
    });
  }

  if (!user.emailVerified) {
    return res.status(403).json({ error: { code: 'EMAIL_NOT_VERIFIED', message: 'Confirm your email address using the link we sent before logging in.' } });
  }

  const csrfToken = await startAuthenticatedSession(req, user._id, user.sessionVersion || 0);
  return res.json({ data: { user: publicUser(user), csrfToken } });
}

async function requestPasswordReset(req, res) {
  if (!isEmailConfigured()) {
    return res.status(503).json({
      error: { code: 'PASSWORD_RESET_UNAVAILABLE', message: 'Password reset email is not configured yet.' },
    });
  }

  const email = req.body.email.trim().toLowerCase();
  const user = await User.findOne({ email, accountStatus: 'active' }).exec();
  if (user) {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    user.passwordResetTokenHash = tokenHash;
    user.passwordResetExpiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
    await user.save();

    try {
      await sendPasswordResetEmail(email, token);
    } catch (error) {
      console.error('Password reset email delivery failed:', error.message);
      await User.updateOne(
        { _id: user._id, passwordResetTokenHash: tokenHash },
        { $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 } },
      );
    }
  }

  return res.status(202).json({
    data: { message: 'If an active account exists for that email, a password reset link will be sent.' },
  });
}

async function resetPassword(req, res) {
  const tokenHash = createHash('sha256').update(req.body.token).digest('hex');
  const user = await User.findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetExpiresAt: { $gt: new Date() },
    accountStatus: 'active',
  }).select('_id').lean().exec();
  if (!user) {
    return res.status(400).json({
      error: { code: 'PASSWORD_RESET_INVALID', message: 'This reset link is invalid or has expired. Request a new link.' },
    });
  }

  const passwordHash = await bcrypt.hash(req.body.password, BCRYPT_COST);
  const result = await User.updateOne(
    {
      _id: user._id,
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() },
      accountStatus: 'active',
    },
    {
      $set: { passwordHash },
      $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 },
      $inc: { sessionVersion: 1 },
    },
  );
  if (!result.modifiedCount) {
    return res.status(400).json({
      error: { code: 'PASSWORD_RESET_INVALID', message: 'This reset link is invalid or has expired. Request a new link.' },
    });
  }

  return res.json({ data: { message: 'Your password has been updated. Log in with your new password.' } });
}
async function verifyEmail(req, res) {
  const tokenHash = createHash('sha256').update(req.body.token).digest('hex');
  const result = await User.updateOne({
    emailVerificationTokenHash: tokenHash,
    emailVerificationExpiresAt: { $gt: new Date() },
    emailVerified: false,
    accountStatus: 'active',
  }, {
    $set: { emailVerified: true },
    $unset: { emailVerificationTokenHash: 1, emailVerificationExpiresAt: 1 },
  });
  if (!result.modifiedCount) {
    return res.status(400).json({ error: { code: 'EMAIL_VERIFICATION_INVALID', message: 'This confirmation link is invalid or has expired.' } });
  }
  return res.json({ data: { message: 'Your email address is confirmed. You can now log in.' } });
}
function currentUser(req, res) {
  res.json({ data: { user: publicUser(req.user) } });
}

function logout(req, res, next) {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('truconnect.sid', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    return res.json({ data: { message: 'You have logged out.' } });
  });
}

module.exports = { currentUser, login, logout, register, requestPasswordReset, resetPassword, verifyEmail };
