const conversationService = require('../services/conversation.service');
const { success } = require('../utils/response');
const { HTTP_STATUS } = require('../utils/constants');

const listConversations = async (req, res, next) => {
  try {
    const data = await conversationService.list({
      page: req.query.page,
      limit: Math.min(Number(req.query.limit) || 20, 100),
      callerNumber: req.query.callerNumber,
      intent: req.query.intent,
      status: req.query.status,
    });
    return success(res, data, 'Conversations retrieved');
  } catch (error) {
    return next(error);
  }
};

const getConversation = async (req, res, next) => {
  try {
    const conversation = await conversationService.getById(req.params.id);
    return success(res, { conversation }, 'Conversation retrieved');
  } catch (error) {
    return next(error);
  }
};

const createConversation = async (req, res, next) => {
  try {
    const conversation = await conversationService.create(req.body, req.user._id);
    return success(res, { conversation }, 'Conversation created', HTTP_STATUS.CREATED);
  } catch (error) {
    return next(error);
  }
};

const deleteConversation = async (req, res, next) => {
  try {
    await conversationService.remove(req.params.id);
    return success(res, {}, 'Conversation deleted');
  } catch (error) {
    return next(error);
  }
};

const listCallLogs = async (req, res, next) => {
  try {
    const data = await conversationService.listCallLogs({
      page: req.query.page,
      limit: Math.min(Number(req.query.limit) || 20, 100),
      status: req.query.status,
      incomingNumber: req.query.incomingNumber,
    });
    return success(res, data, 'Call logs retrieved');
  } catch (error) {
    return next(error);
  }
};

const getCallLog = async (req, res, next) => {
  try {
    const callLog = await conversationService.getCallLogById(req.params.id);
    return success(res, { callLog }, 'Call log retrieved');
  } catch (error) {
    return next(error);
  }
};

const createCallLog = async (req, res, next) => {
  try {
    const callLog = await conversationService.createCallLog(req.body);
    return success(res, { callLog }, 'Call log created', HTTP_STATUS.CREATED);
  } catch (error) {
    return next(error);
  }
};

const updateCallLog = async (req, res, next) => {
  try {
    const callLog = await conversationService.updateCallLog(req.params.id, req.body);
    return success(res, { callLog }, 'Call log updated');
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listConversations,
  getConversation,
  createConversation,
  deleteConversation,
  listCallLogs,
  getCallLog,
  createCallLog,
  updateCallLog,
};
