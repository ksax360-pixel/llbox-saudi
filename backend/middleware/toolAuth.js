const { fail } = require('../utils/response');
const { HTTP_STATUS } = require('../utils/constants');

/**
 * Optional shared secret for /api/tools/* when TOOL_API_KEY is set.
 * n8n can send: Authorization: Bearer <key> or X-Tool-Api-Key: <key>
 */
const optionalToolAuth = (req, res, next) => {
  const expected = process.env.TOOL_API_KEY;
  if (!expected) return next();

  const authHeader = String(req.headers.authorization || '');
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const headerKey = String(req.headers['x-tool-api-key'] || '').trim();
  const provided = bearer || headerKey;

  if (provided && provided === expected) return next();

  return fail(res, 'Unauthorized tool request', HTTP_STATUS.UNAUTHORIZED);
};

module.exports = {
  optionalToolAuth,
};
