const digitsOnly = (value = '') => String(value).replace(/\D/g, '');

const normalizePhone = (value = '') => {
  const digits = digitsOnly(value);
  if (!digits) return '';
  return `+${digits}`;
};

module.exports = {
  digitsOnly,
  normalizePhone,
};
