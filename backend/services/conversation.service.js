const Conversation = require('../models/Conversation');
const CallLog = require('../models/CallLog');
const { HTTP_STATUS } = require('../utils/constants');

class ConversationService {
  async list({ page = 1, limit = 20, callerNumber, intent, status } = {}) {
    const filter = {};
    if (callerNumber) filter.callerNumber = new RegExp(callerNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    if (intent) filter.intent = intent;
    if (status) filter.status = status;

    const skip = (Math.max(page, 1) - 1) * limit;
    const [items, total] = await Promise.all([
      Conversation.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
      Conversation.countDocuments(filter),
    ]);

    return {
      items,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getById(id) {
    const conversation = await Conversation.findById(id).lean();
    if (!conversation) {
      const error = new Error('Conversation not found');
      error.statusCode = HTTP_STATUS.NOT_FOUND;
      throw error;
    }
    return conversation;
  }

  async create(payload, userId) {
    const conversation = await Conversation.create({
      ...payload,
      createdBy: userId,
      timestamp: payload.timestamp || new Date(),
    });
    return conversation;
  }

  async remove(id) {
    const conversation = await Conversation.findByIdAndDelete(id);
    if (!conversation) {
      const error = new Error('Conversation not found');
      error.statusCode = HTTP_STATUS.NOT_FOUND;
      throw error;
    }
    return conversation;
  }

  async listCallLogs({ page = 1, limit = 20, status, incomingNumber } = {}) {
    const filter = {};
    if (status) filter.status = status;
    if (incomingNumber) {
      filter.incomingNumber = new RegExp(
        incomingNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i'
      );
    }

    const skip = (Math.max(page, 1) - 1) * limit;
    const [items, total] = await Promise.all([
      CallLog.find(filter).sort({ startedAt: -1 }).skip(skip).limit(limit).lean(),
      CallLog.countDocuments(filter),
    ]);

    return {
      items,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async createCallLog(payload) {
    return CallLog.create(payload);
  }

  async getCallLogById(id) {
    const log = await CallLog.findById(id).lean();
    if (!log) {
      const error = new Error('Call log not found');
      error.statusCode = HTTP_STATUS.NOT_FOUND;
      throw error;
    }
    return log;
  }

  async updateCallLog(id, payload) {
    const log = await CallLog.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });
    if (!log) {
      const error = new Error('Call log not found');
      error.statusCode = HTTP_STATUS.NOT_FOUND;
      throw error;
    }
    return log;
  }
}

module.exports = new ConversationService();
