const Setting = require('../models/Setting');
const { success, fail } = require('../utils/response');
const { HTTP_STATUS } = require('../utils/constants');

const maskSettings = (settings) =>
  settings.map((s) => (typeof s.toSafeObject === 'function' ? s.toSafeObject() : s));

const listSettings = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.category) filter.category = req.query.category;

    const settings = await Setting.find(filter).sort({ category: 1, key: 1 });
    return success(res, { items: maskSettings(settings) }, 'Settings retrieved');
  } catch (error) {
    return next(error);
  }
};

const getSetting = async (req, res, next) => {
  try {
    const setting = await Setting.findById(req.params.id);
    if (!setting) {
      return fail(res, 'Setting not found', HTTP_STATUS.NOT_FOUND);
    }
    return success(res, { setting: setting.toSafeObject() });
  } catch (error) {
    return next(error);
  }
};

const getSettingByKey = async (req, res, next) => {
  try {
    const setting = await Setting.findOne({ key: req.params.key });
    if (!setting) {
      return fail(res, 'Setting not found', HTTP_STATUS.NOT_FOUND);
    }
    return success(res, { setting: setting.toSafeObject() });
  } catch (error) {
    return next(error);
  }
};

const createSetting = async (req, res, next) => {
  try {
    const setting = await Setting.create({
      ...req.body,
      updatedBy: req.user._id,
    });
    return success(res, { setting: setting.toSafeObject() }, 'Setting created', HTTP_STATUS.CREATED);
  } catch (error) {
    return next(error);
  }
};

const updateSetting = async (req, res, next) => {
  try {
    const setting = await Setting.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user._id },
      { new: true, runValidators: true }
    );

    if (!setting) {
      return fail(res, 'Setting not found', HTTP_STATUS.NOT_FOUND);
    }

    return success(res, { setting: setting.toSafeObject() }, 'Setting updated');
  } catch (error) {
    return next(error);
  }
};

const deleteSetting = async (req, res, next) => {
  try {
    const setting = await Setting.findByIdAndDelete(req.params.id);
    if (!setting) {
      return fail(res, 'Setting not found', HTTP_STATUS.NOT_FOUND);
    }
    return success(res, {}, 'Setting deleted');
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listSettings,
  getSetting,
  getSettingByKey,
  createSetting,
  updateSetting,
  deleteSetting,
};
