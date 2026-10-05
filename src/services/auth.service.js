const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const notification = require('./notification.service');

const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');
const newToken = () => crypto.randomBytes(32).toString('hex');
const signToken = (user) => jwt.sign({ id: user._id }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

async function register(payload) {
  const exists = await User.findOne({ email: payload.email });
  if (exists) throw ApiError.conflict('An account with this email already exists', 'EMAIL_TAKEN');

  const { password, ...rest } = payload;
  const user = new User(rest);
  await user.setPassword(password);

  const verifyToken = newToken();
  user.emailVerificationToken = hashToken(verifyToken);
  user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();

  notification.sendVerificationEmail(user, verifyToken); // fire-and-forget; never blocks signup

  return { user, token: signToken(user) };
}

async function login({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !(await user.matchPassword(password))) {
    throw ApiError.unauthorized('Incorrect email or password', 'INVALID_CREDENTIALS');
  }
  if (!user.active) throw ApiError.forbidden('This account has been disabled', 'ACCOUNT_DISABLED');

  user.lastLoginAt = new Date();
  await user.save();
  return { user, token: signToken(user) };
}

async function verifyEmail(token) {
  const user = await User.findOne({
    emailVerificationToken: hashToken(token),
    emailVerificationExpires: { $gt: new Date() },
  }).select('+emailVerificationToken +emailVerificationExpires');
  if (!user) throw ApiError.badRequest('Verification link is invalid or expired', 'INVALID_TOKEN');

  user.emailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();
  return user;
}

async function resendVerification(user) {
  if (user.emailVerified) throw ApiError.badRequest('Email is already verified', 'ALREADY_VERIFIED');
  const token = newToken();
  user.emailVerificationToken = hashToken(token);
  user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();
  notification.sendVerificationEmail(user, token);
}

async function forgotPassword(email) {
  // Always succeed from the caller's perspective: do not reveal which emails exist.
  const user = await User.findOne({ email });
  if (!user) return;
  const token = newToken();
  user.passwordResetToken = hashToken(token);
  user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();
  notification.sendPasswordResetEmail(user, token);
}

async function resetPassword(token, password) {
  const user = await User.findOne({
    passwordResetToken: hashToken(token),
    passwordResetExpires: { $gt: new Date() },
  }).select('+passwordResetToken +passwordResetExpires');
  if (!user) throw ApiError.badRequest('Reset link is invalid or expired', 'INVALID_TOKEN');

  await user.setPassword(password);
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();
  return user;
}

async function changePassword(userId, currentPassword, newPassword) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!(await user.matchPassword(currentPassword))) {
    throw ApiError.badRequest('Current password is incorrect', 'INVALID_CREDENTIALS');
  }
  await user.setPassword(newPassword);
  await user.save();
}

async function updateProfile(userId, updates) {
  return User.findByIdAndUpdate(userId, updates, { new: true, runValidators: true });
}

module.exports = {
  register, login, verifyEmail, resendVerification, forgotPassword,
  resetPassword, changePassword, updateProfile, signToken,
};