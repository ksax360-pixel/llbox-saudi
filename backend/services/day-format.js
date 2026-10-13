/** Human day / time labels for replies (never print an ISO date to a person — Test Report 2026-10-04 F19). */

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;

const parseIso = (isoDate) => {
  const m = String(isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
};

/** "Thursday 8 October" / "الخميس 8 أكتوبر" */
const dayLabel = (isoDate, lang = 'en') => {
  const d = parseIso(isoDate);
  if (!d) return '';
  return lang === 'ar'
    ? `${DAYS_AR[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS_AR[d.getUTCMonth()]}`
    : `${DAYS_EN[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS_EN[d.getUTCMonth()]}`;
};

/** " for Thursday 8 October" / " ليوم الخميس 8 أكتوبر" */
const formatDay = (isoDate, lang = 'en') => {
  const label = dayLabel(isoDate, lang);
  if (!label) return '';
  return lang === 'ar' ? ` ليوم ${label}` : ` for ${label}`;
};

const weekdayName = (index, lang = 'en') => (lang === 'ar' ? DAYS_AR[index] : DAYS_EN[index]) || '';

/** "Thursday 8 October, 14:30" in Riyadh time. */
const timeLabel = (isoDateTime, lang = 'en') => {
  const t = Date.parse(isoDateTime || '');
  if (!Number.isFinite(t)) return '';
  const local = new Date(t + RIYADH_OFFSET_MS);
  const hh = String(local.getUTCHours()).padStart(2, '0');
  const mm = String(local.getUTCMinutes()).padStart(2, '0');
  return `${dayLabel(local.toISOString().slice(0, 10), lang)}, ${hh}:${mm}`;
};

const riyadhTodayIso = (nowMs = Date.now()) => new Date(nowMs + RIYADH_OFFSET_MS).toISOString().slice(0, 10);

module.exports = { dayLabel, formatDay, weekdayName, timeLabel, riyadhTodayIso, MONTHS_EN, MONTHS_AR, DAYS_EN, DAYS_AR };
