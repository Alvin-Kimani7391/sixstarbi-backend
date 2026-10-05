const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const authService = require('../services/auth.service');
const audit = require('../services/audit.service');
const Business = require('../models/Business');

const register = asyncHandler(async (req, res) => {
  const { user, token } = await authService.register(req.body);
  await audit.record(req, 'AUTH_REGISTER', { userId: user._id, entityType: 'User', entityId: user._id });
  created(res, { user, token });
});

const login = asyncHandler(async (req, res) => {
  const { user, token } = await authService.login(req.body);
  await audit.record(req, 'AUTH_LOGIN', { userId: user._id, businessId: user.businessId });
  ok(res, { user, token });
});

const logout = asyncHandler(async (req, res) => {
  // Tokens are stateless; the client discards the token. Cookie cleared for cookie-based clients.
  res.clearCookie('token');
  await audit.record(req, 'AUTH_LOGOUT');
  ok(res, { message: 'Logged out' });
});

const me = asyncHandler(async (req, res) => {
  const business = req.businessId ? await Business.findById(req.businessId) : null;
  ok(res, { user: req.user, business });
});

const verifyEmail = asyncHandler(async (req, res) => {
  await authService.verifyEmail(req.body.token);
  ok(res, { message: 'Email verified' });
});

const resendVerification = asyncHandler(async (req, res) => {
  await authService.resendVerification(req.user);
  ok(res, { message: 'Verification email sent' });
});

const forgotPassword = asyncHandler(async (req, res) => {
  await authService.forgotPassword(req.body.email);
  ok(res, { message: 'If that email exists, a reset link has been sent' });
});

const resetPassword = asyncHandler(async (req, res) => {
  const user = await authService.resetPassword(req.body.token, req.body.password);
  await audit.record(req, 'AUTH_PASSWORD_RESET', { userId: user._id, businessId: user.businessId });
  ok(res, { message: 'Password updated' });
});

const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user._id, req.body.currentPassword, req.body.newPassword);
  await audit.record(req, 'AUTH_PASSWORD_CHANGED');
  ok(res, { message: 'Password changed' });
});

const updateProfile = asyncHandler(async (req, res) => {
  const user = await authService.updateProfile(req.user._id, req.body);
  ok(res, { user });
});

module.exports = {
  register, login, logout, me, verifyEmail, resendVerification,
  forgotPassword, resetPassword, changePassword, updateProfile,
};