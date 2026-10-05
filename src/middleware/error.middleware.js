const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const env = require('../config/env');

const notFound = (req, _res, next) =>
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`, 'ROUTE_NOT_FOUND'));

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, _req, res, _next) => {
  let status = err.statusCode || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'Something went wrong';
  let details = err.details;

  if (err.name === 'ValidationError' && err.errors) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err.code === 11000) {
    status = 409;
    code = 'DUPLICATE';
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    message = `A record with this ${field} already exists`;
  } else if (err.name === 'CastError') {
    status = 400;
    code = 'INVALID_ID';
    message = `Invalid ${err.path}`;
  } else if (err.name === 'MulterError') {
    status = 400;
    code = 'UPLOAD_ERROR';
  }

  if (status >= 500) {
    logger.error(err);
    if (env.isProd) message = 'Something went wrong';
  }

  const error = { code, message };
  if (details) error.details = details;
  res.status(status).json({ success: false, error });
};

module.exports = { notFound, errorHandler };