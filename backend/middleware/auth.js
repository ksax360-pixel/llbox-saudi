const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { fail } = require('../utils/response');
const { ROLE_HIERARCHY, HTTP_STATUS } = require('../utils/constants');

const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return fail(res, 'Authentication required', HTTP_STATUS.UNAUTHORIZED);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || !user.isActive) {
      return fail(res, 'Invalid or inactive user', HTTP_STATUS.UNAUTHORIZED);
    }

    req.user = user;
    return next();
  } catch (error) {
    return fail(res, 'Invalid or expired token', HTTP_STATUS.UNAUTHORIZED);
  }
};

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return fail(res, 'Authentication required', HTTP_STATUS.UNAUTHORIZED);
    }

    if (!allowedRoles.includes(req.user.role)) {
      return fail(res, 'You do not have permission to perform this action', HTTP_STATUS.FORBIDDEN);
    }

    return next();
  };
};

const authorizeMinRole = (minRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return fail(res, 'Authentication required', HTTP_STATUS.UNAUTHORIZED);
    }

    const userLevel = ROLE_HIERARCHY[req.user.role] || 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] || 0;

    if (userLevel < requiredLevel) {
      return fail(res, 'You do not have permission to perform this action', HTTP_STATUS.FORBIDDEN);
    }

    return next();
  };
};

module.exports = {
  authenticate,
  authorize,
  authorizeMinRole,
};
