const llboxService = require('../services/llbox.service');
const { success } = require('../utils/response');
const logger = require('../config/logger');

const resolveDelivery = async (req, res, next) => {
  try {
    const { orderReference } = req.body;
    logger.info(`Tool resolve-delivery: ${orderReference}`);
    const data = await llboxService.resolveDelivery(orderReference);
    return success(res, data, 'Delivery resolved');
  } catch (error) {
    return next(error);
  }
};

const confirmDelivery = async (req, res, next) => {
  try {
    logger.info(`Tool confirm-delivery: ${JSON.stringify(req.body)}`);
    const data = await llboxService.confirmDelivery(req.body);
    return success(res, data, data.message || 'Delivery Confirmed');
  } catch (error) {
    return next(error);
  }
};

const registerDelivery = async (req, res, next) => {
  try {
    logger.info(`Tool register-delivery: ${JSON.stringify(req.body)}`);
    const data = await llboxService.registerDelivery(req.body);
    return success(res, data, data.message || 'Delivery Registered');
  } catch (error) {
    return next(error);
  }
};

const findCustomer = async (req, res, next) => {
  try {
    logger.info(`Tool find-customer: ${JSON.stringify(req.body)}`);
    const data = await llboxService.findCustomer(req.body);
    return success(res, data, 'Customer lookup complete');
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  resolveDelivery,
  confirmDelivery,
  registerDelivery,
  findCustomer,
};
