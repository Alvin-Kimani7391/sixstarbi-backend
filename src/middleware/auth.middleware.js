const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Authenticates the request and sets:
 *   req.user       -> the user document
 *   req.businessId -> the tenant scope for EVERY downstream query
 */
const protect = asyncHandler(async (req, _res, next) => {
  let token;
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) token = header.split(' ')[1];
  else if (req.cookies && req.cookies.token) token = req.cookies.token;

  if (!token) throw ApiError.unauthorized('Please log in to continue');

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw ApiError.unauthorized('Invalid or expired session', 'INVALID_TOKEN');
  }

  const user = await User.findById(payload.id);
  if (!user || !user.active) throw ApiError.unauthorized('Account not found or disabled');

  req.user = user;
  req.businessId = user.businessId || null;
  next();
});

/** Role-based access control, enforced server-side. */
const authorize = (...roles) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) {
    return next(ApiError.forbidden(`Role ${req.user.role} cannot perform this action`));
  }
  next();
};

/** Routes that operate on business data must have a business. */
const requireBusiness = (req, _res, next) => {
  if (!req.businessId) {
    return next(
      ApiError.badRequest('Create your business before using this feature', 'BUSINESS_REQUIRED')
    );
  }
  next();
};

module.exports = { protect, authorize, requireBusiness };