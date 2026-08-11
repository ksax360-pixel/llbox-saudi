const express = require('express');
const conversationController = require('../controllers/conversation.controller');
const { authenticate, authorizeMinRole, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const {
  mongoIdParam,
  createConversationRules,
  createCallLogRules,
  updateCallLogRules,
} = require('../middleware/validators');
const { ROLES } = require('../utils/constants');

const router = express.Router();

router.use(authenticate);

router.get('/', authorizeMinRole(ROLES.VIEWER), conversationController.listConversations);
router.get('/call-logs', authorizeMinRole(ROLES.VIEWER), conversationController.listCallLogs);
router.get('/call-logs/:id', authorizeMinRole(ROLES.VIEWER), mongoIdParam, validate, conversationController.getCallLog);
router.post(
  '/call-logs',
  authorizeMinRole(ROLES.OPERATOR),
  createCallLogRules,
  validate,
  conversationController.createCallLog
);
router.patch(
  '/call-logs/:id',
  authorizeMinRole(ROLES.OPERATOR),
  updateCallLogRules,
  validate,
  conversationController.updateCallLog
);

router.get('/:id', authorizeMinRole(ROLES.VIEWER), mongoIdParam, validate, conversationController.getConversation);
router.post(
  '/',
  authorizeMinRole(ROLES.OPERATOR),
  createConversationRules,
  validate,
  conversationController.createConversation
);
router.delete(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.OPERATOR),
  mongoIdParam,
  validate,
  conversationController.deleteConversation
);

module.exports = router;
