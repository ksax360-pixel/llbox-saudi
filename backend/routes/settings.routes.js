const express = require('express');
const settingsController = require('../controllers/settings.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const {
  mongoIdParam,
  settingCreateRules,
  settingUpdateRules,
} = require('../middleware/validators');
const { ROLES } = require('../utils/constants');

const router = express.Router();

router.use(authenticate, authorize(ROLES.ADMIN));

router.get('/', settingsController.listSettings);
router.get('/key/:key', settingsController.getSettingByKey);
router.get('/:id', mongoIdParam, validate, settingsController.getSetting);
router.post('/', settingCreateRules, validate, settingsController.createSetting);
router.patch('/:id', settingUpdateRules, validate, settingsController.updateSetting);
router.delete('/:id', mongoIdParam, validate, settingsController.deleteSetting);

module.exports = router;
