const User = require('../models/User');
const { success, fail } = require('../utils/response');
const { HTTP_STATUS, ROLES } = require('../utils/constants');

const listUsers = async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }

    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);

    return success(res, {
      items: users.map((u) => u.toSafeObject()),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (error) {
    return next(error);
  }
};

const getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return fail(res, 'User not found', HTTP_STATUS.NOT_FOUND);
    }
    return success(res, { user: user.toSafeObject() });
  } catch (error) {
    return next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const allowed = ['name', 'role', 'isActive'];
    const updates = {};
    allowed.forEach((key) => {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    });

    if (updates.role && !Object.values(ROLES).includes(updates.role)) {
      return fail(res, 'Invalid role', HTTP_STATUS.BAD_REQUEST);
    }

    const user = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      return fail(res, 'User not found', HTTP_STATUS.NOT_FOUND);
    }

    return success(res, { user: user.toSafeObject() }, 'User updated');
  } catch (error) {
    return next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    if (String(req.user._id) === String(req.params.id)) {
      return fail(res, 'You cannot delete your own account', HTTP_STATUS.BAD_REQUEST);
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return fail(res, 'User not found', HTTP_STATUS.NOT_FOUND);
    }

    return success(res, {}, 'User deleted');
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listUsers,
  getUser,
  updateUser,
  deleteUser,
};
