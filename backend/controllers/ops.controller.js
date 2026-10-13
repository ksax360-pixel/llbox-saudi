const opsService = require('../services/ops.service');
const { success } = require('../utils/response');

const getDashboard = async (req, res, next) => {
  try {
    const data = await opsService.dashboard();
    return success(res, data, 'Dashboard retrieved');
  } catch (error) {
    return next(error);
  }
};

const listDeliveries = async (req, res, next) => {
  try {
    const deliveries = await opsService.listDeliveries();
    return success(res, { deliveries }, 'Deliveries retrieved');
  } catch (error) {
    return next(error);
  }
};

const getDelivery = async (req, res, next) => {
  try {
    const delivery = await opsService.getDelivery(req.params.id);
    return success(res, { delivery }, 'Delivery retrieved');
  } catch (error) {
    return next(error);
  }
};

const listLockers = async (req, res, next) => {
  try {
    const lockers = await opsService.listLockers();
    return success(res, { lockers }, 'Lockers retrieved');
  } catch (error) {
    return next(error);
  }
};

const getLocker = async (req, res, next) => {
  try {
    const data = await opsService.getLocker(req.params.id);
    return success(res, data, 'Locker retrieved');
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getDashboard,
  listDeliveries,
  getDelivery,
  listLockers,
  getLocker,
};
