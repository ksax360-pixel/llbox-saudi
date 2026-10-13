const express = require('express');
const authController = require('../controllers/auth.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { loginRules, registerRules, otpResendRules, otpVerifyRules } = require('../middleware/validators');
const { ROLES } = require('../utils/constants');

const router = express.Router();

router.get('/public-config', authController.publicConfig);
router.post('/login', loginRules, validate, authController.login);
router.post('/otp/resend', otpResendRules, validate, authController.resendOtp);
router.post('/otp/verify', otpVerifyRules, validate, authController.verifyOtp);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.me);
router.post(
  '/register',
  authenticate,
  authorize(ROLES.ADMIN),
  registerRules,
  validate,
  authController.register
);

module.exports = router;
