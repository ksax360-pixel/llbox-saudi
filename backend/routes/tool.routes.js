const express = require('express');
const toolController = require('../controllers/tool.controller');
const { validate } = require('../middleware/validation');
const { optionalToolAuth } = require('../middleware/toolAuth');
const {
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
} = require('../middleware/validators');

const router = express.Router();

router.use(optionalToolAuth);

// Public tool endpoints for n8n / ElevenLabs agent runtime
router.post('/resolve-delivery', resolveDeliveryRules, validate, toolController.resolveDelivery);
router.post('/confirm-delivery', confirmDeliveryRules, validate, toolController.confirmDelivery);
router.post('/register-delivery', registerDeliveryRules, validate, toolController.registerDelivery);
router.post('/find-customer', findCustomerRules, validate, toolController.findCustomer);
router.post(
  '/clear-locker-session',
  clearLockerSessionRules,
  validate,
  toolController.clearLockerSession
);
router.post('/validate-otp', validateOtpRules, validate, toolController.validateOtp);
router.post('/get-delivery-status', getDeliveryStatusRules, validate, toolController.getDeliveryStatus);
router.post(
  '/create-support-ticket',
  createSupportTicketRules,
  validate,
  toolController.createSupportTicket
);
router.post('/identify-whatsapp', identifyWhatsappRules, validate, toolController.identifyWhatsapp);
router.post('/notify-recipient', notifyRecipientRules, validate, toolController.notifyRecipient);
router.post('/conversation-turn', conversationTurnRules, validate, toolController.conversationTurn);

module.exports = router;
