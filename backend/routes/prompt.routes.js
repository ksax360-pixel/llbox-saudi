const express = require('express');
const promptController = require('../controllers/prompt.controller');
const { authenticate, authorizeMinRole, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const {
  mongoIdParam,
  promptCreateRules,
  promptUpdateRules,
} = require('../middleware/validators');
const { ROLES } = require('../utils/constants');

const router = express.Router();

router.use(authenticate);

router.get('/', authorizeMinRole(ROLES.VIEWER), promptController.listPrompts);
router.get('/:id', authorizeMinRole(ROLES.VIEWER), mongoIdParam, validate, promptController.getPrompt);
router.post(
  '/',
  authorize(ROLES.ADMIN, ROLES.OPERATOR),
  promptCreateRules,
  validate,
  promptController.createPrompt
);
router.patch(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.OPERATOR),
  promptUpdateRules,
  validate,
  promptController.updatePrompt
);
router.delete(
  '/:id',
  authorize(ROLES.ADMIN),
  mongoIdParam,
  validate,
  promptController.deletePrompt
);

module.exports = router;
