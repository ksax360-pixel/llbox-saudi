const ROLES = {
  ADMIN: 'admin',
  OPERATOR: 'operator',
  VIEWER: 'viewer',
};

const ROLE_HIERARCHY = {
  [ROLES.ADMIN]: 3,
  [ROLES.OPERATOR]: 2,
  [ROLES.VIEWER]: 1,
};

const CALL_STATUS = {
  RINGING: 'ringing',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  BUSY: 'busy',
  NO_ANSWER: 'no_answer',
  CANCELLED: 'cancelled',
};

const PROMPT_TYPES = {
  SYSTEM: 'system',
  GREETING: 'greeting',
  FALLBACK: 'fallback',
  LANGUAGE: 'language',
};

const SETTING_CATEGORIES = {
  TWILIO: 'twilio',
  ELEVENLABS: 'elevenlabs',
  LLBOX: 'llbox',
  GOOGLE_MAPS: 'google_maps',
  OPENAI: 'openai',
  GENERAL: 'general',
};

const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
};

module.exports = {
  ROLES,
  ROLE_HIERARCHY,
  CALL_STATUS,
  PROMPT_TYPES,
  SETTING_CATEGORIES,
  HTTP_STATUS,
};
