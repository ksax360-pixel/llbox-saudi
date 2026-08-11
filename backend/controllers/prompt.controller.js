const Prompt = require('../models/Prompt');
const { success, fail } = require('../utils/response');
const { HTTP_STATUS } = require('../utils/constants');

const listPrompts = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.type) filter.type = req.query.type;
    if (req.query.language) filter.language = req.query.language;
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Prompt.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
      Prompt.countDocuments(filter),
    ]);

    return success(res, {
      items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (error) {
    return next(error);
  }
};

const getPrompt = async (req, res, next) => {
  try {
    const prompt = await Prompt.findById(req.params.id).lean();
    if (!prompt) {
      return fail(res, 'Prompt not found', HTTP_STATUS.NOT_FOUND);
    }
    return success(res, { prompt });
  } catch (error) {
    return next(error);
  }
};

const createPrompt = async (req, res, next) => {
  try {
    const prompt = await Prompt.create({
      ...req.body,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });
    return success(res, { prompt }, 'Prompt created', HTTP_STATUS.CREATED);
  } catch (error) {
    return next(error);
  }
};

const updatePrompt = async (req, res, next) => {
  try {
    const existing = await Prompt.findById(req.params.id);
    if (!existing) {
      return fail(res, 'Prompt not found', HTTP_STATUS.NOT_FOUND);
    }

    const updates = { ...req.body, updatedBy: req.user._id };
    if (req.body.content && req.body.content !== existing.content) {
      updates.version = (existing.version || 1) + 1;
    }

    const prompt = await Prompt.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    return success(res, { prompt }, 'Prompt updated');
  } catch (error) {
    return next(error);
  }
};

const deletePrompt = async (req, res, next) => {
  try {
    const prompt = await Prompt.findByIdAndDelete(req.params.id);
    if (!prompt) {
      return fail(res, 'Prompt not found', HTTP_STATUS.NOT_FOUND);
    }
    return success(res, {}, 'Prompt deleted');
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listPrompts,
  getPrompt,
  createPrompt,
  updatePrompt,
  deletePrompt,
};
