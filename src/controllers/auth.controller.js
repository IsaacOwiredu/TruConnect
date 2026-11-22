const bcrypt = require('bcrypt');
const { User, Worker } = require('../models');
const { publicUser, startAuthenticatedSession } = require('../services/auth.service');

const BCRYPT_COST = 12;
const DUMMY_PASSWORD_HASH = bcrypt.hash('not-a-real-truconnect-account-password', BCRYPT_COST);

async function register(req, res) {
  const fullName = req.body.fullName.trim();
  const email = req.body.email.trim().toLowerCase();
  const role = req.body.role;
  const existingUser = await User.exists({ email });
  if (existingUser) {
    return res.status(409).json({ error: { code: 'EMAIL_ALREADY_REGISTERED', message: 'An account already exists for that email address. Log in or use a different email.' } });
  }
  const passwordHash = await bcrypt.hash(req.body.password, BCRYPT_COST);

  const user = await User.create({ fullName, email, passwordHash, role });
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

  const csrfToken = await startAuthenticatedSession(req, user._id);
  res.status(201).json({ data: { user: publicUser(user), csrfToken } });
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

  const csrfToken = await startAuthenticatedSession(req, user._id);
  return res.json({ data: { user: publicUser(user), csrfToken } });
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

module.exports = { currentUser, login, logout, register };
