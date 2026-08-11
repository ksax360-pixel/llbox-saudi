const express = require('express');
const knowledgeController = require('../controllers/knowledge.controller');
const { authenticate, authorizeMinRole } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const {
  mongoIdParam,
  knowledgeCreateRules,
  knowledgeUpdateRules,
  searchRules,
} = require('../middleware/validators');
const { ROLES } = require('../utils/constants');

const router = express.Router();

router.use(authenticate);

router.get('/', authorizeMinRole(ROLES.VIEWER), knowledgeController.listKnowledge);
router.get('/search', authorizeMinRole(ROLES.VIEWER), searchRules, validate, knowledgeController.searchKnowledge);
router.get('/:id', authorizeMinRole(ROLES.VIEWER), mongoIdParam, validate, knowledgeController.getKnowledge);
router.post(
  '/',
  authorizeMinRole(ROLES.OPERATOR),
  knowledgeCreateRules,
  validate,
  knowledgeController.createKnowledge
);
router.patch(
  '/:id',
  authorizeMinRole(ROLES.OPERATOR),
  knowledgeUpdateRules,
  validate,
  knowledgeController.updateKnowledge
);
router.delete(
  '/:id',
  authorizeMinRole(ROLES.ADMIN),
  mongoIdParam,
  validate,
  knowledgeController.deleteKnowledge
);

module.exports = router;
