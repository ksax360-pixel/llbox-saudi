const express = require('express');
const crmController = require('../controllers/crm.controller');
const { authenticate, authorizeMinRole, authorize } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');

const analyticsRouter = express.Router();
analyticsRouter.use(authenticate, authorizeMinRole(ROLES.VIEWER));
analyticsRouter.get('/', crmController.getAnalytics);

const adminRouter = express.Router();
adminRouter.use(authenticate, authorize(ROLES.ADMIN));
adminRouter.get('/summary', crmController.getAdminSummary);
adminRouter.get('/audit-logs', crmController.listAuditLogs);

module.exports = { analyticsRouter, adminRouter };
