const Knowledge = require('../models/Knowledge');
const { HTTP_STATUS } = require('../utils/constants');

class KnowledgeService {
  async list({ page = 1, limit = 20, category, isPublished } = {}) {
    const filter = {};
    if (category) filter.category = category;
    if (isPublished !== undefined) filter.isPublished = isPublished === 'true' || isPublished === true;

    const skip = (Math.max(page, 1) - 1) * limit;
    const [items, total] = await Promise.all([
      Knowledge.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
      Knowledge.countDocuments(filter),
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

  async search(query, { page = 1, limit = 20 } = {}) {
    if (!query || !String(query).trim()) {
      const error = new Error('Search query is required');
      error.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw error;
    }

    const filter = {
      $text: { $search: query },
      isPublished: true,
    };

    const skip = (Math.max(page, 1) - 1) * limit;
    const [items, total] = await Promise.all([
      Knowledge.find(filter, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } })
        .skip(skip)
        .limit(limit)
        .lean(),
      Knowledge.countDocuments(filter),
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
    const article = await Knowledge.findById(id).lean();
    if (!article) {
      const error = new Error('Knowledge article not found');
      error.statusCode = HTTP_STATUS.NOT_FOUND;
      throw error;
    }
    return article;
  }

  async create(payload, userId) {
    return Knowledge.create({
      ...payload,
      createdBy: userId,
      updatedBy: userId,
    });
  }

  async update(id, payload, userId) {
    const article = await Knowledge.findByIdAndUpdate(
      id,
      { ...payload, updatedBy: userId },
      { new: true, runValidators: true }
    );
    if (!article) {
      const error = new Error('Knowledge article not found');
      error.statusCode = HTTP_STATUS.NOT_FOUND;
      throw error;
    }
    return article;
  }

  async remove(id) {
    const article = await Knowledge.findByIdAndDelete(id);
    if (!article) {
      const error = new Error('Knowledge article not found');
      error.statusCode = HTTP_STATUS.NOT_FOUND;
      throw error;
    }
    return article;
  }
}

module.exports = new KnowledgeService();
