const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AuthOtp = require('../models/AuthOtp');
const Setting = require('../models/Setting');
const { success, fail } = require('../utils/response');
const { HTTP_STATUS, ROLES } = require('../utils/constants');
const logger = require('../config/logger');
const crmService = require('../services/crm.service');
const whatsappService = require('../services/whatsapp.service');
const { digitsOnly } = require('../utils/phone');

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

const signToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

const generateOtpCode = () => String(Math.floor(100000 + Math.random() * 900000));

const maskPhone = (phone = '') => {
  const digits = digitsOnly(phone);
  if (digits.length <= 4) return digits;
  return `***${digits.slice(-4)}`;
};

const createOtpSession = async (userId, purpose = 'login_2fa') => {
  const code = generateOtpCode();
  const sessionId = crypto.randomUUID();
  await AuthOtp.create({
    sessionId,
    userId,
    codeHash: await bcrypt.hash(code, 10),
    purpose,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });
  return { sessionId, code };
};

const sendOtpToUser = async (user, code) => {
  if (!user.mobile) {
    return { sent: false, reason: 'no_mobile' };
  }
  if (!whatsappService.isConfigured()) {
    return { sent: false, reason: 'not_configured' };
  }
  try {
    await whatsappService.sendAuthenticationOtp(user.mobile, code);
    return { sent: true };
  } catch (error) {
    logger.warn(`WhatsApp OTP send failed for ${user.email}: ${error.message}`);
    return { sent: false, reason: error.message };
  }
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

    const requires2FA = user.role === ROLES.ADMIN;

    if (requires2FA) {
      const { sessionId, code } = await createOtpSession(user._id, 'login_2fa');
      const delivery = await sendOtpToUser(user, code);

      return success(res, {
        requires2FA: true,
        otpSessionId: sessionId,
        maskedPhone: user.mobile ? maskPhone(user.mobile) : null,
        otpSent: delivery.sent,
        user: user.toSafeObject(),
      }, delivery.sent ? 'Verification code sent to WhatsApp' : 'Enter verification code');
    }

    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    const token = signToken(user._id);
    logger.info(`User logged in: ${user.email}`);
    const ip = String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
    await crmService
      .logAudit({
        userId: user._id,
        userName: user.name,
        action: 'login',
        resource: 'auth',
        ipAddress: ip,
        afterValue: user.email,
      })
      .catch(() => {});

    return success(res, {
      token,
      user: user.toSafeObject(),
    }, 'Login successful');
  } catch (error) {
    return next(error);
  }
};

const resendOtp = async (req, res, next) => {
  try {
    const { otpSessionId } = req.body;
    const record = await AuthOtp.findOne({ sessionId: otpSessionId, purpose: 'login_2fa' });
    if (!record || record.expiresAt < new Date()) {
      return fail(res, 'Verification session expired. Please sign in again.', HTTP_STATUS.BAD_REQUEST);
    }

    const user = await User.findById(record.userId);
    if (!user || !user.isActive) {
      return fail(res, 'User not found', HTTP_STATUS.NOT_FOUND);
    }

    const code = generateOtpCode();
    record.codeHash = await bcrypt.hash(code, 10);
    record.expiresAt = new Date(Date.now() + OTP_TTL_MS);
    record.attempts = 0;
    await record.save();

    const delivery = await sendOtpToUser(user, code);
    return success(res, {
      otpSent: delivery.sent,
      maskedPhone: user.mobile ? maskPhone(user.mobile) : null,
    }, delivery.sent ? 'Verification code sent to WhatsApp' : 'Could not send WhatsApp code');
  } catch (error) {
    return next(error);
  }
};

const verifyOtp = async (req, res, next) => {
  try {
    const { otpSessionId, code } = req.body;
    const record = await AuthOtp.findOne({ sessionId: otpSessionId });
    if (!record || record.expiresAt < new Date()) {
      return fail(res, 'Verification code expired. Please sign in again.', HTTP_STATUS.BAD_REQUEST);
    }

    if (record.attempts >= MAX_OTP_ATTEMPTS) {
      return fail(res, 'Too many attempts. Please sign in again.', HTTP_STATUS.TOO_MANY_REQUESTS);
    }

    const valid = await bcrypt.compare(String(code), record.codeHash);
    if (!valid) {
      record.attempts += 1;
      await record.save();
      return fail(res, 'Invalid verification code', HTTP_STATUS.UNAUTHORIZED);
    }

    const user = await User.findById(record.userId);
    if (!user || !user.isActive) {
      return fail(res, 'User not found', HTTP_STATUS.NOT_FOUND);
    }

    await AuthOtp.deleteOne({ _id: record._id });

    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    const token = signToken(user._id);
    logger.info(`User verified 2FA: ${user.email}`);

    return success(res, {
      token,
      user: user.toSafeObject(),
    }, 'Verification successful');
  } catch (error) {
    return next(error);
  }
};

const logout = async (req, res) => {
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
    const { name, email, password, role, mobile } = req.body;

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return fail(res, 'Email already registered', HTTP_STATUS.CONFLICT);
    }

    const user = await User.create({
      name,
      email,
      password,
      role: role || ROLES.VIEWER,
      mobile: mobile ? `+${digitsOnly(mobile)}` : '',
    });

    let otpSent = false;
    if (user.mobile) {
      try {
        const { code } = await createOtpSession(user._id, 'user_verify');
        const delivery = await sendOtpToUser(user, code);
        otpSent = delivery.sent;
      } catch (error) {
        logger.warn(`User verify OTP not sent for ${user.email}: ${error.message}`);
      }
    }

    logger.info(`User registered: ${user.email} (${user.role})`);

    return success(res, {
      user: user.toSafeObject(),
      otpSent,
      maskedPhone: user.mobile ? maskPhone(user.mobile) : null,
    }, otpSent ? 'User created and verification OTP sent on WhatsApp' : 'User created', HTTP_STATUS.CREATED);
  } catch (error) {
    return next(error);
  }
};

const publicConfig = async (req, res, next) => {
  try {
    let googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
    if (!googleMapsApiKey) {
      const setting = await Setting.findOne({ key: 'google_maps.api_key', isActive: true });
      googleMapsApiKey = setting?.value || '';
    }

    return success(res, {
      googleMapsApiKey,
      whatsappOtpEnabled: whatsappService.isConfigured(),
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  login,
  logout,
  me,
  register,
  resendOtp,
  verifyOtp,
  publicConfig,
};
