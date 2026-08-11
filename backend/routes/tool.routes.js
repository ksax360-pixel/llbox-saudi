const express = require('express');
const toolController = require('../controllers/tool.controller');
const { authenticate, authorizeMinRole } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const {
  resolveDeliveryRules,
  confirmDeliveryRules,
  registerDeliveryRules,
  findCustomerRules,
} = require('../middleware/validators');
const { ROLES } = require('../utils/constants');

const router = express.Router();

// Tools are callable by Operator+ (AI agent runtime / operators)
router.use(authenticate, authorizeMinRole(ROLES.OPERATOR));

router.post('/resolve-delivery', resolveDeliveryRules, validate, toolController.resolveDelivery);
router.post('/confirm-delivery', confirmDeliveryRules, validate, toolController.confirmDelivery);
router.post('/register-delivery', registerDeliveryRules, validate, toolController.registerDelivery);
router.post('/find-customer', findCustomerRules, validate, toolController.findCustomer);

module.exports = router;
