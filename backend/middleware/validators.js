const { body, param, query } = require('express-validator');
const { ROLES, PROMPT_TYPES, SETTING_CATEGORIES, CALL_STATUS } = require('../utils/constants');

const loginRules = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 120 }),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('mobile').trim().notEmpty().withMessage('Mobile number is required for WhatsApp verification'),
  body('role').optional().isIn(Object.values(ROLES)).withMessage('Invalid role'),
];

const otpResendRules = [
  body('otpSessionId').trim().notEmpty().withMessage('otpSessionId is required'),
];

const otpVerifyRules = [
  body('otpSessionId').trim().notEmpty().withMessage('otpSessionId is required'),
  body('code').trim().isLength({ min: 6, max: 6 }).withMessage('Enter the 6-digit code'),
];

const mongoIdParam = [param('id').isMongoId().withMessage('Invalid id')];

const resolveDeliveryRules = [
  body('orderReference').trim().notEmpty().withMessage('orderReference is required'),
];

const confirmDeliveryRules = [
  body('deliverySessionId').trim().notEmpty().withMessage('deliverySessionId is required'),
  body('boxId').notEmpty().withMessage('boxId is required'),
  body('driverPhone').optional().isString(),
  body('otpProvided').optional().isString(),
  body('parcelCount').optional().isInt({ min: 1 }),
  body('vendorName').optional().isString(),
  body('notes').optional().isString(),
];

const registerDeliveryRules = [
  body('whatsappPhone').trim().notEmpty().withMessage('whatsappPhone is required'),
  body('orderReference').trim().notEmpty().withMessage('orderReference is required'),
  body('boxId').optional(),
  body('expectedDeliveryDate').optional().isString(),
  body('expected_delivery_date').optional().isString(),
];

const clearLockerSessionRules = [
  body('orderReference').optional().isString(),
  body('boxId').optional(),
  body('deliverySessionId').optional().isString(),
  body().custom((_, { req }) => {
    if (!req.body.orderReference && !req.body.boxId && !req.body.deliverySessionId) {
      throw new Error('orderReference or boxId is required');
    }
    return true;
  }),
];

const validateOtpRules = [
  body('otp').optional().isString(),
  body('otpProvided').optional().isString(),
  body('deliverySessionId').optional().isString(),
  body('boxId').optional(),
  body('orderReference').optional().isString(),
  body().custom((_, { req }) => {
    if (!req.body.otp && !req.body.otpProvided) {
      throw new Error('otp or otpProvided is required');
    }
    return true;
  }),
];

const getDeliveryStatusRules = [
  body('orderReference').optional().isString(),
  body('order_reference').optional().isString(),
  body().custom((_, { req }) => {
    if (!req.body.orderReference && !req.body.order_reference) {
      throw new Error('orderReference is required');
    }
    return true;
  }),
];

const createSupportTicketRules = [
  body('ticket').optional().isObject(),
  body('correlationId').optional().isString(),
];

const identifyWhatsappRules = [
  body('whatsappPhone').optional().isString(),
  body('phone').optional().isString(),
  body().custom((_, { req }) => {
    if (!req.body.whatsappPhone && !req.body.phone) {
      throw new Error('whatsappPhone or phone is required');
    }
    return true;
  }),
];

const conversationTurnRules = [
  body('phone').isString().notEmpty(),
  body('text').optional({ nullable: true }).isString(),
  body('inputType').optional().isString(),
  body('mediaContext').optional({ nullable: true }).isString(),
  body('aiReply').optional({ nullable: true }).isString(),
  body('messageId').optional({ nullable: true }).isString(),
];

const notifyRecipientRules = [
  body('orderReference').optional().isString(),
  body('order_reference').optional().isString(),
  body('issue').optional().isString(),
  body('note').optional().isString(),
  body().custom((_, { req }) => {
    if (!req.body.orderReference && !req.body.order_reference) {
      throw new Error('orderReference is required');
    }
    return true;
  }),
];

const findCustomerRules = [
  body('whatsappPhone')
    .optional()
    .isString()
    .withMessage('whatsappPhone must be a string'),
  body('phone').optional().isString().withMessage('phone must be a string'),
  body().custom((_, { req }) => {
    if (!req.body.whatsappPhone && !req.body.phone) {
      throw new Error('whatsappPhone or phone is required');
    }
    return true;
  }),
];

const createConversationRules = [
  body('callerNumber').trim().notEmpty().withMessage('callerNumber is required'),
  body('transcript').optional().isString(),
  body('duration').optional().isInt({ min: 0 }),
  body('language').optional().isString(),
  body('intent').optional().isString(),
  body('toolCalls').optional().isArray(),
  body('response').optional().isString(),
  body('status').optional().isIn(['active', 'completed', 'failed', 'abandoned']),
  body('timestamp').optional().isISO8601().toDate(),
];

const createCallLogRules = [
  body('incomingNumber').trim().notEmpty().withMessage('incomingNumber is required'),
  body('twilioCallSid').optional().isString(),
  body('elevenLabsConversationId').optional().isString(),
  body('status').optional().isIn(Object.values(CALL_STATUS)),
  body('duration').optional().isInt({ min: 0 }),
  body('recordingUrl').optional().isString(),
  body('startedAt').optional().isISO8601().toDate(),
  body('endedAt').optional().isISO8601().toDate(),
  body('direction').optional().isIn(['inbound', 'outbound']),
];

const updateCallLogRules = [
  ...mongoIdParam,
  body('status').optional().isIn(Object.values(CALL_STATUS)),
  body('duration').optional().isInt({ min: 0 }),
  body('recordingUrl').optional().isString(),
  body('endedAt').optional().isISO8601().toDate(),
  body('elevenLabsConversationId').optional().isString(),
  body('notes').optional().isString(),
];

const knowledgeCreateRules = [
  body('title').trim().notEmpty().withMessage('title is required').isLength({ max: 200 }),
  body('content').trim().notEmpty().withMessage('content is required'),
  body('category').optional().isString(),
  body('tags').optional().isArray(),
  body('language').optional().isString(),
  body('isPublished').optional().isBoolean(),
];

const knowledgeUpdateRules = [
  ...mongoIdParam,
  body('title').optional().trim().notEmpty().isLength({ max: 200 }),
  body('content').optional().trim().notEmpty(),
  body('category').optional().isString(),
  body('tags').optional().isArray(),
  body('language').optional().isString(),
  body('isPublished').optional().isBoolean(),
];

const searchRules = [
  query('q').optional().isString(),
  query('query').optional().isString(),
];

const promptCreateRules = [
  body('name').trim().notEmpty().withMessage('name is required'),
  body('type').isIn(Object.values(PROMPT_TYPES)).withMessage('Invalid prompt type'),
  body('content').trim().notEmpty().withMessage('content is required'),
  body('language').optional().isString(),
  body('isActive').optional().isBoolean(),
  body('description').optional().isString(),
];

const promptUpdateRules = [
  ...mongoIdParam,
  body('name').optional().trim().notEmpty(),
  body('type').optional().isIn(Object.values(PROMPT_TYPES)),
  body('content').optional().trim().notEmpty(),
  body('language').optional().isString(),
  body('isActive').optional().isBoolean(),
  body('description').optional().isString(),
];

const settingCreateRules = [
  body('key').trim().notEmpty().withMessage('key is required'),
  body('category').isIn(Object.values(SETTING_CATEGORIES)).withMessage('Invalid category'),
  body('value').exists().withMessage('value is required'),
  body('label').optional().isString(),
  body('description').optional().isString(),
  body('isSecret').optional().isBoolean(),
  body('isActive').optional().isBoolean(),
];

const settingUpdateRules = [
  ...mongoIdParam,
  body('key').optional().trim().notEmpty(),
  body('category').optional().isIn(Object.values(SETTING_CATEGORIES)),
  body('value').optional(),
  body('label').optional().isString(),
  body('description').optional().isString(),
  body('isSecret').optional().isBoolean(),
  body('isActive').optional().isBoolean(),
];

const updateUserRules = [
  ...mongoIdParam,
  body('name').optional().trim().notEmpty(),
  body('role').optional().isIn(Object.values(ROLES)),
  body('isActive').optional().isBoolean(),
];

module.exports = {
  loginRules,
  registerRules,
  otpResendRules,
  otpVerifyRules,
  mongoIdParam,
  resolveDeliveryRules,
  confirmDeliveryRules,
  registerDeliveryRules,
  findCustomerRules,
  clearLockerSessionRules,
  validateOtpRules,
  getDeliveryStatusRules,
  createSupportTicketRules,
  identifyWhatsappRules,
  notifyRecipientRules,
  conversationTurnRules,
  createConversationRules,
  createCallLogRules,
  updateCallLogRules,
  knowledgeCreateRules,
  knowledgeUpdateRules,
  searchRules,
  promptCreateRules,
  promptUpdateRules,
  settingCreateRules,
  settingUpdateRules,
  updateUserRules,
};
