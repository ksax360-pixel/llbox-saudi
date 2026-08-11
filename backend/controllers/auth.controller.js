const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { success, fail } = require('../utils/response');
const { HTTP_STATUS, ROLES } = require('../utils/constants');
const logger = require('../config/logger');

const signToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return fail(res, 'Invalid email or password', HTTP_STATUS.UNAUTHORIZED);
    }

    if (!user.isActive) {
      return fail(res, 'Account is deactivated', HTTP_STATUS.FORBIDDEN);
    }

    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    const token = signToken(user._id);
    logger.info(`User logged in: ${user.email}`);

    return success(res, {
      token,
      user: user.toSafeObject(),
    }, 'Login successful');
  } catch (error) {
    return next(error);
  }
};

const logout = async (req, res) => {
  // Stateless JWT – client discards the token. Hook for future token blacklist.
  logger.info(`User logged out: ${req.user?.email || 'unknown'}`);
  return success(res, {}, 'Logout successful');
};

const me = async (req, res, next) => {
  try {
    return success(res, { user: req.user.toSafeObject() }, 'Profile retrieved');
  } catch (error) {
    return next(error);
  }
};

const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return fail(res, 'Email already registered', HTTP_STATUS.CONFLICT);
    }

    const user = await User.create({
      name,
      email,
      password,
      role: role || ROLES.VIEWER,
    });

    logger.info(`User registered: ${user.email} (${user.role})`);

    return success(res, { user: user.toSafeObject() }, 'User created', HTTP_STATUS.CREATED);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  login,
  logout,
  me,
  register,
};
