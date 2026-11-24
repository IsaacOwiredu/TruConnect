const nodemailer = require('nodemailer');

function isEmailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.MAIL_FROM);
}

function createTransporter() {
  const port = Number(process.env.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT must be a valid port number.');
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
      : undefined,
  });
}

async function sendPasswordResetEmail(email, token) {
  const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
  const resetUrl = new URL('/reset-password.html', baseUrl);
  resetUrl.searchParams.set('token', token);
  if (process.env.NODE_ENV === 'production' && resetUrl.protocol !== 'https:') {
    throw new Error('PUBLIC_BASE_URL must use HTTPS in production.');
  }

  await createTransporter().sendMail({
    from: process.env.MAIL_FROM,
    to: email,
    subject: 'Reset your TruConnect password',
    text: 'Use this link within one hour to choose a new password: ' + resetUrl.href,
    html: '<p>Someone requested a password reset for a TruConnect account.</p><p><a href="' + resetUrl.href + '">Choose a new password</a></p><p>This link expires in one hour. If you did not request it, you can ignore this email.</p>',
  });
}

async function sendEmailVerificationEmail(email, token) {
  const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
  const verificationUrl = new URL('/verify-email.html', baseUrl);
  verificationUrl.searchParams.set('token', token);
  if (process.env.NODE_ENV === 'production' && verificationUrl.protocol !== 'https:') {
    throw new Error('PUBLIC_BASE_URL must use HTTPS in production.');
  }

  await createTransporter().sendMail({
    from: process.env.MAIL_FROM,
    to: email,
    subject: 'Confirm your TruConnect email address',
    text: 'Confirm your email address within 24 hours: ' + verificationUrl.href,
    html: '<p>Thanks for creating a TruConnect account.</p><p><a href="' + verificationUrl.href + '">Confirm your email address</a></p><p>This link expires in 24 hours. If you did not create an account, you can ignore this email.</p>',
  });
}

module.exports = { isEmailConfigured, sendEmailVerificationEmail, sendPasswordResetEmail };
