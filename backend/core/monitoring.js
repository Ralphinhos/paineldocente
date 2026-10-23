const { calendarDays, delayFacts } = require('./timing');
const { distinctStructureRows } = require('../services/dashboardService');

const ACCESS_ORDER = { CRITICAL: 0, NEVER: 1, ATTENTION: 2, NOT_VERIFIABLE: 3, CURRENT: 4 };
const DELIVERY_ORDER = { OVERDUE: 0, NOT_VERIFIABLE: 1, PENDING: 2, DELIVERED_LATE: 3, EARLY: 4, ON_TIME: 5, INHERITED_READY: 6, NOT_APPLICABLE: 7 };
const unknownAccess = () => ({ status: 'NOT_VERIFIABLE', lastAccessAt: null, daysSinceAccess: null });
const deliveryKeys = { OVERDUE: 'overdue', PENDING: 'pendingInTime', DELIVERED_LATE: 'deliveredLate', EARLY: 'early', ON_TIME: 'onTime', INHERITED_READY: 'inherited', NOT_VERIFIABLE: 'validation', NOT_APPLICABLE: 'notApplicable' };
const emptyCounts = () => ({ overdue: 0, pendingInTime: 0, deliveredLate: 0, early: 0, onTime: 0, inherited: 0, validation: 0 });

function deliveryCharts(records, asOf) {
  const teachers = new Map();
  const activities = new Map();
  for (const record of records) {
    if (record.displayStatus === 'NOT_APPLICABLE' || record.item.responsibility === 'UNCONFIRMED') continue;
    const { teacher, item, course, displayStatus } = record;
    const verifiedDue = displayStatus !== 'NOT_VERIFIABLE' && item.deadlineAt && calendarDays(asOf, item.deadlineAt) > 0;
    const group = teachers.get(teacher.id) || { teacher, total: 0, counts: emptyCounts(), due: 0, onTimeDue: 0, maxDaysLate: 0 };
    group.total += 1;
    group.counts[deliveryKeys[displayStatus]] += 1;
    if (verifiedDue) {
      group.due += 1;
      if (['EARLY', 'ON_TIME', 'INHERITED_READY'].includes(displayStatus)) group.onTimeDue += 1;
    }
    if (displayStatus === 'OVERDUE') group.maxDaysLate = Math.max(group.maxDaysLate, item.daysLate || 0);
    teachers.set(teacher.id, group);
    const id = `${course.modality}:${item.id}`;
    const activity = activities.get(id) || { id, label: item.label, modality: course.modalityLabel, overdue: 0, due: 0, maxDaysLate: 0 };
    if (verifiedDue) activity.due += 1;
    if (displayStatus === 'OVERDUE') { activity.overdue += 1; activity.maxDaysLate = Math.max(activity.maxDaysLate, item.daysLate || 0); }
    activities.set(id, activity);
  }
  return {
    teacherOverview: [...teachers.values()].map((row) => ({ ...row, overduePercent: row.due ? row.counts.overdue / row.due * 100 : null, onTimePercent: row.due ? row.onTimeDue / row.due * 100 : null }))
      .sort((a, b) => b.maxDaysLate - a.maxDaysLate || b.counts.overdue - a.counts.overdue || a.teacher.name.localeCompare(b.teacher.name, 'pt-BR')),
    activityChart: [...activities.values()].filter((row) => row.overdue > 0)
      .sort((a, b) => b.overdue - a.overdue || b.maxDaysLate - a.maxDaysLate || a.label.localeCompare(b.label, 'pt-BR')).slice(0, 10),
  };
}

function environmentRecords(rows, asOf, includeInactive = false) {
  const teachers = new Map();
  for (const row of rows) {
    if (!includeInactive && (new Date(row.course.startsAt) > new Date(asOf) || new Date(row.course.endsAt) < new Date(asOf))) continue;
    const access = row.environmentAccess || unknownAccess();
    const existing = teachers.get(row.teacher.id);
    if (!existing) teachers.set(row.teacher.id, { teacher: row.teacher, ...access, courses: new Map([[row.course.id, row.course]]) });
    else {
      if (existing.status !== access.status || existing.lastAccessAt !== access.lastAccessAt || existing.daysSinceAccess !== access.daysSinceAccess) Object.assign(existing, unknownAccess());
      existing.courses.set(row.course.id, row.course);
    }
  }
  return [...teachers.values()].map((record) => ({ ...record, courses: [...record.courses.values()] }))
    .sort((a, b) => ACCESS_ORDER[a.status] - ACCESS_ORDER[b.status] || (b.daysSinceAccess ?? -1) - (a.daysSinceAccess ?? -1) || a.teacher.name.localeCompare(b.teacher.name, 'pt-BR'));
}

function deliveryRecord(row, asOf) {
  const unassigned = row.requirement.responsibility === 'UNCONFIRMED';
  const item = {
    ...row.requirement, ...delayFacts(row, asOf), status: unassigned ? 'NOT_VERIFIABLE' : row.structureStatus,
    reasonCode: unassigned ? 'OWNER_UNCONFIRMED' : row.reasonCode,
    reason: unassigned ? 'Responsável pela entrega precisa ser confirmado pelo NED.' : row.reason,
    overdue: !unassigned && row.overdue, deadlineAt: row.deadlineAt, deadlineSource: row.deadlineSource,
    configuredAt: row.configuredAt, readyByAt: row.readyByAt || null, timingSource: row.timingSource, expectedQuantity: row.expectedQuantity,
    observedQuantity: row.observedQuantity, evidence: row.evidence || [],
    manualEvidenceDate: row.manualEvidenceDate || null, publishedDate: row.publishedDate || null,
    manualVersion: row.manualVersion || null, manualJustification: row.manualJustification || null,
  };
  let displayStatus = item.status;
  if (item.status === 'PENDING') displayStatus = item.overdue ? 'OVERDUE' : 'PENDING';
  if (item.status === 'DELIVERED_ON_TIME') {
    const delivered = row.manualEvidenceDate || row.configuredAt;
    const early = row.timingSource !== 'SNAPSHOT_OBSERVED' && delivered && row.deadlineAt && calendarDays(row.deadlineAt, delivered) > 0;
    displayStatus = early ? 'EARLY' : 'ON_TIME';
  }
  return { id: `${row.course.id}:${row.requirement.id}`, course: row.course, teacher: row.teacher, item, displayStatus };
}

function buildMonitoring(rows, asOf, options = {}) {
  const accessRows = environmentRecords(rows, asOf, options.includeInactiveAccess);
  const deliveryRows = distinctStructureRows(rows).map((row) => deliveryRecord(row, asOf))
    .sort((a, b) => DELIVERY_ORDER[a.displayStatus] - DELIVERY_ORDER[b.displayStatus] || (b.item.daysLate ?? -1) - (a.item.daysLate ?? -1) || a.teacher.name.localeCompare(b.teacher.name, 'pt-BR') || a.course.shortName.localeCompare(b.course.shortName, 'pt-BR') || a.item.label.localeCompare(b.item.label, 'pt-BR'));
  const access = { total: accessRows.length, current: 0, attention: 0, critical: 0, never: 0, validation: 0 };
  const accessKeys = { CURRENT: 'current', ATTENTION: 'attention', CRITICAL: 'critical', NEVER: 'never', NOT_VERIFIABLE: 'validation' };
  for (const row of accessRows) access[accessKeys[row.status]] += 1;
  const deliveries = { total: 0, overdue: 0, pendingInTime: 0, deliveredLate: 0, early: 0, onTime: 0, inherited: 0, validation: 0, notApplicable: 0 };
  const teacherBars = new Map();
  for (const row of deliveryRows) {
    deliveries[deliveryKeys[row.displayStatus]] += 1;
    if (row.displayStatus !== 'NOT_APPLICABLE') deliveries.total += 1;
    if (row.displayStatus !== 'OVERDUE') continue;
    const bar = teacherBars.get(row.teacher.id) || { teacher: row.teacher, overdue: 0, maxDaysLate: 0 };
    bar.overdue += 1;
    bar.maxDaysLate = Math.max(bar.maxDaysLate, row.item.daysLate || 0);
    teacherBars.set(row.teacher.id, bar);
  }
  return {
    access: {
      summary: access, rows: accessRows,
      chart: accessRows.filter((row) => ['CRITICAL', 'ATTENTION'].includes(row.status)).slice(0, 10),
      priorities: accessRows.filter((row) => row.status !== 'CURRENT').slice(0, 5),
      panorama: [...accessRows].sort((a, b) => (b.daysSinceAccess ?? -1) - (a.daysSinceAccess ?? -1) || a.teacher.name.localeCompare(b.teacher.name, 'pt-BR'))
        .map(({ teacher, status, daysSinceAccess }) => ({ teacher, status, daysSinceAccess })),
    },
    deliveries: { summary: deliveries, rows: deliveryRows, chart: [...teacherBars.values()].sort((a, b) => b.maxDaysLate - a.maxDaysLate || b.overdue - a.overdue || a.teacher.name.localeCompare(b.teacher.name, 'pt-BR')).slice(0, 10), ...deliveryCharts(deliveryRows, asOf) },
  };
}

function pageRows(rows, pageValue, pageSizeValue) {
  const pageSize = Math.max(5, Math.min(Number(pageSizeValue) || 20, 50));
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.max(1, Math.min(pages, Number(pageValue) || 1));
  return { rows: rows.slice((page - 1) * pageSize, page * pageSize), pagination: { page, pageSize, pages, total: rows.length } };
}

module.exports = { buildMonitoring, environmentRecords, pageRows };
