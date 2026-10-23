const { saoPauloDate } = require('./timing');

function officialDeadline(catalog, period, modality, courseId, requirementId) {
  const scope = catalog?.periods?.[period]?.[modality];
  return scope?.courses?.[courseId]?.[requirementId] || scope?.defaults?.[requirementId] || null;
}

function validCivilDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00.000Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Noon in São Paulo avoids an unintended civil-day shift when dates are serialized.
const civilDateToIso = (value) => value + 'T15:00:00.000Z';
const civilDates = (value) => (Array.isArray(value) ? value : value ? [value] : []).map(saoPauloDate);

function applyDeadlineCatalog(raw, catalog) {
  if (!catalog) return raw;
  for (const course of raw.courses) {
    for (const [requirementId, configured] of Object.entries(catalog.periods?.[course.period]?.[course.modality]?.defaults || {})) {
      course.requirementDeadlines ||= {};
      course.requirementDeadlines[requirementId] = configured;
    }
    for (const [requirementId, configured] of Object.entries(catalog.periods?.[course.period]?.[course.modality]?.courses?.[course.id] || {})) {
      course.requirementDeadlines ||= {};
      course.requirementDeadlines[requirementId] = configured;
    }
    for (const activity of course.activities) {
      const configured = officialDeadline(catalog, course.period, course.modality, course.id, activity.requirementId);
      if (configured) Object.assign(activity, { deadlineAt: Array.isArray(configured) ? configured[0] || null : configured, deadlineSource: 'OFFICIAL_CATALOG' });
    }
  }
  return raw;
}

module.exports = { applyDeadlineCatalog, civilDateToIso, civilDates, officialDeadline, validCivilDate };
