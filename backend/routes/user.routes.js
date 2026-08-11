const express = require('express');
const userController = require('../controllers/user.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { mongoIdParam, updateUserRules } = require('../middleware/validators');
const { ROLES } = require('../utils/constants');

const router = express.Router();

router.use(authenticate, authorize(ROLES.ADMIN));

router.get('/', userController.listUsers);
router.get('/:id', mongoIdParam, validate, userController.getUser);
router.patch('/:id', updateUserRules, validate, userController.updateUser);
router.delete('/:id', mongoIdParam, validate, userController.deleteUser);

module.exports = router;
