const logger = require('../config/logger');
const { fail } = require('../utils/response');
const { HTTP_STATUS } = require('../utils/constants');

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  logger.error(`${req.method} ${req.originalUrl} – ${err.message}`, {
    stack: err.stack,
  });

  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors || {}).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return fail(res, 'Validation failed', HTTP_STATUS.UNPROCESSABLE, errors);
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return fail(res, `Duplicate value for ${field}`, HTTP_STATUS.CONFLICT);
  }

  if (err.name === 'CastError') {
    return fail(res, 'Invalid resource id', HTTP_STATUS.BAD_REQUEST);
  }

  if (err.name === 'JsonWebTokenError') {
    return fail(res, 'Invalid token', HTTP_STATUS.UNAUTHORIZED);
  }

  if (err.name === 'TokenExpiredError') {
    return fail(res, 'Token expired', HTTP_STATUS.UNAUTHORIZED);
  }

  const statusCode = err.statusCode || HTTP_STATUS.INTERNAL_ERROR;
  const message =
    process.env.NODE_ENV === 'production' && statusCode === HTTP_STATUS.INTERNAL_ERROR
      ? 'Internal server error'
      : err.message || 'Internal server error';

  return fail(res, message, statusCode);
};

const notFound = (req, res) => {
  return fail(res, `Route not found: ${req.method} ${req.originalUrl}`, HTTP_STATUS.NOT_FOUND);
};

module.exports = {
  errorHandler,
  notFound,
};
