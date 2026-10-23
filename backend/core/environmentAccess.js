const { calendarDays } = require('./timing');

// Site access is an independent fact. Course logs must never be used as a fallback.
function calculateEnvironmentAccess(teacher, asOf, thresholds) {
  const unknown = { status: 'NOT_VERIFIABLE', lastAccessAt: null, daysSinceAccess: null };
  if (!teacher.environmentAccessKnown) return unknown;
  if (!teacher.environmentLastAccessAt) return { ...unknown, status: 'NEVER' };
  const last = new Date(teacher.environmentLastAccessAt);
  if (Number.isNaN(last.getTime()) || last > new Date(asOf)) return unknown;
  const days = calendarDays(asOf, last);
  const status = days <= thresholds.currentMaxDays ? 'CURRENT' : days <= thresholds.attentionMaxDays ? 'ATTENTION' : 'CRITICAL';
  return { status, lastAccessAt: last.toISOString(), daysSinceAccess: days };
}

module.exports = { calculateEnvironmentAccess };
