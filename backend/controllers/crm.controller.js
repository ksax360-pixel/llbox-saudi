const crmService = require('../services/crm.service');
const { success } = require('../utils/response');

const listCustomers = async (req, res, next) => {
  try {
    const customers = await crmService.listCustomers();
    return success(res, { customers });
  } catch (error) {
    return next(error);
  }
};

const getCustomer = async (req, res, next) => {
  try {
    const data = await crmService.getCustomer(req.params.id);
    return success(res, data);
  } catch (error) {
    return next(error);
  }
};

const listDrivers = async (req, res, next) => {
  try {
    const drivers = await crmService.listDrivers();
    return success(res, { drivers });
  } catch (error) {
    return next(error);
  }
};

const getDriver = async (req, res, next) => {
  try {
    const data = await crmService.getDriver(req.params.id);
    return success(res, data);
  } catch (error) {
    return next(error);
  }
};

const listVoiceCalls = async (req, res, next) => {
  try {
    const calls = await crmService.listVoiceCalls();
    return success(res, { calls });
  } catch (error) {
    return next(error);
  }
};

const getVoiceCall = async (req, res, next) => {
  try {
    const call = await crmService.getVoiceCall(req.params.id);
    return success(res, { call });
  } catch (error) {
    return next(error);
  }
};

const getAnalytics = async (req, res, next) => {
  try {
    const data = await crmService.analytics();
    return success(res, data);
  } catch (error) {
    return next(error);
  }
};

const listAuditLogs = async (req, res, next) => {
  try {
    const logs = await crmService.listAuditLogs();
    return success(res, { logs });
  } catch (error) {
    return next(error);
  }
};

const getAdminSummary = async (req, res, next) => {
  try {
    const [roleCounts, logs] = await Promise.all([
      crmService.roleCounts(),
      crmService.listAuditLogs(),
    ]);
    return success(res, { roleCounts, logs });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listCustomers,
  getCustomer,
  listDrivers,
  getDriver,
  listVoiceCalls,
  getVoiceCall,
  getAnalytics,
  listAuditLogs,
  getAdminSummary,
};
