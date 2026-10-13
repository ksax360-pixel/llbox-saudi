const express = require('express');
const crmController = require('../controllers/crm.controller');
const { authenticate, authorizeMinRole } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');

const router = express.Router();
router.use(authenticate, authorizeMinRole(ROLES.VIEWER));
router.get('/', crmController.listVoiceCalls);
router.get('/:id', crmController.getVoiceCall);
module.exports = router;
