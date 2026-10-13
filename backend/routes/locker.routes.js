const express = require('express');
const opsController = require('../controllers/ops.controller');
const { authenticate, authorizeMinRole } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');

const router = express.Router();

router.use(authenticate, authorizeMinRole(ROLES.VIEWER));

router.get('/', opsController.listLockers);
router.get('/:id', opsController.getLocker);

module.exports = router;
