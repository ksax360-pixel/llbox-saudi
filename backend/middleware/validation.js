const { validationResult } = require('express-validator');
const { fail } = require('../utils/response');
const { HTTP_STATUS } = require('../utils/constants');

const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return fail(
      res,
      'Validation failed',
      HTTP_STATUS.UNPROCESSABLE,
      errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
        value: err.value,
      }))
    );
  }

  return next();
};

module.exports = { validate };
