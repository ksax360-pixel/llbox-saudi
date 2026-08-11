const knowledgeService = require('../services/knowledge.service');
const { success } = require('../utils/response');
const { HTTP_STATUS } = require('../utils/constants');

const listKnowledge = async (req, res, next) => {
  try {
    const data = await knowledgeService.list({
      page: req.query.page,
      limit: Math.min(Number(req.query.limit) || 20, 100),
      category: req.query.category,
      isPublished: req.query.isPublished,
    });
    return success(res, data, 'Knowledge articles retrieved');
  } catch (error) {
    return next(error);
  }
};

const searchKnowledge = async (req, res, next) => {
  try {
    const data = await knowledgeService.search(req.query.q || req.query.query, {
      page: req.query.page,
      limit: Math.min(Number(req.query.limit) || 20, 100),
    });
    return success(res, data, 'Search results');
  } catch (error) {
    return next(error);
  }
};

const getKnowledge = async (req, res, next) => {
  try {
    const article = await knowledgeService.getById(req.params.id);
    return success(res, { article }, 'Article retrieved');
  } catch (error) {
    return next(error);
  }
};

const createKnowledge = async (req, res, next) => {
  try {
    const article = await knowledgeService.create(req.body, req.user._id);
    return success(res, { article }, 'Article created', HTTP_STATUS.CREATED);
  } catch (error) {
    return next(error);
  }
};

const updateKnowledge = async (req, res, next) => {
  try {
    const article = await knowledgeService.update(req.params.id, req.body, req.user._id);
    return success(res, { article }, 'Article updated');
  } catch (error) {
    return next(error);
  }
};

const deleteKnowledge = async (req, res, next) => {
  try {
    await knowledgeService.remove(req.params.id);
    return success(res, {}, 'Article deleted');
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listKnowledge,
  searchKnowledge,
  getKnowledge,
  createKnowledge,
  updateKnowledge,
  deleteKnowledge,
};
