const { buildMonitoring } = require('./monitoring');
const { calendarDays } = require('./timing');

const onTime = new Set(['EARLY', 'ON_TIME', 'INHERITED_READY']);
const late = new Set(['OVERDUE', 'DELIVERED_LATE']);
const byName = (a, b) => a.teacher.name.localeCompare(b.teacher.name, 'pt-BR') || a.teacher.id.localeCompare(b.teacher.id);

function semesterAnalysis(snapshot, filters = {}) {
  const rows = snapshot.rows.filter((row) => (!filters.period || row.course.period === filters.period)
    && (!filters.modality || row.course.modality === filters.modality));
  const result = buildMonitoring(rows, snapshot.generatedAt, { includeInactiveAccess: true });
  if (filters.bimester) {
    result.deliveries = buildMonitoring(rows.filter((row) => row.requirement.baseId.endsWith('_' + filters.bimester)), snapshot.generatedAt).deliveries;
  }
  const teachers = new Map(result.access.rows.map((access) => [access.teacher.id, {
    teacher: access.teacher, access, courses: access.courses.length,
    total: 0, due: 0, onTimeDue: 0, lateDue: 0, overdue: 0, deliveredLate: 0, pending: 0, validation: 0, maxOpenDays: 0,
  }]));
  for (const record of result.deliveries.rows) {
    // An unconfirmed owner cannot be ranked as if the item belonged to this teacher.
    if (record.item.responsibility === 'UNCONFIRMED' || record.displayStatus === 'NOT_APPLICABLE') continue;
    const teacher = teachers.get(record.teacher.id);
    if (!teacher) continue;
    teacher.total += 1;
    if (record.displayStatus === 'NOT_VERIFIABLE') teacher.validation += 1;
    if (record.displayStatus === 'PENDING') teacher.pending += 1;
    if (record.displayStatus === 'OVERDUE') {
      teacher.overdue += 1;
      teacher.maxOpenDays = Math.max(teacher.maxOpenDays, record.item.daysLate || 0);
    }
    if (record.displayStatus === 'DELIVERED_LATE') teacher.deliveredLate += 1;
    if (record.displayStatus !== 'NOT_VERIFIABLE' && record.item.deadlineAt && calendarDays(snapshot.generatedAt, record.item.deadlineAt) > 0) {
      teacher.due += 1;
      if (onTime.has(record.displayStatus)) teacher.onTimeDue += 1;
      if (late.has(record.displayStatus)) teacher.lateDue += 1;
    }
  }
  const teacherRows = [...teachers.values()].map((row) => ({ ...row,
    onTimePercent: row.due ? row.onTimeDue / row.due * 100 : null,
    latePercent: row.due ? row.lateDue / row.due * 100 : null,
  }));
  const measured = result.access.rows.filter((row) => Number.isFinite(row.daysSinceAccess) && row.status !== 'NOT_VERIFIABLE');
  const totals = teacherRows.reduce((sum, row) => ({ due: sum.due + row.due, onTimeDue: sum.onTimeDue + row.onTimeDue, lateDue: sum.lateDue + row.lateDue }), { due: 0, onTimeDue: 0, lateDue: 0 });
  return {
    summary: { teachers: teachers.size, courses: new Set(rows.map((row) => row.course.id)).size, ...totals,
      access: result.access.summary, deliveries: result.deliveries.summary,
      accessAlerts: result.access.summary.attention + result.access.summary.critical + result.access.summary.never,
    },
    teachers: teacherRows.sort((a, b) => (b.latePercent ?? -1) - (a.latePercent ?? -1) || b.due - a.due || byName(a, b)),
    topLate: teacherRows.filter((row) => row.due > 0 && row.lateDue > 0)
      .sort((a, b) => b.latePercent - a.latePercent || b.due - a.due || byName(a, b)).slice(0, 10),
    topOnTime: teacherRows.filter((row) => row.due > 0 && row.onTimeDue > 0)
      .sort((a, b) => b.onTimePercent - a.onTimePercent || b.due - a.due || byName(a, b)).slice(0, 10),
    topAbsent: measured.filter((row) => ['ATTENTION', 'CRITICAL'].includes(row.status))
      .sort((a, b) => b.daysSinceAccess - a.daysSinceAccess || byName(a, b)).slice(0, 10),
    topRecent: measured.filter((row) => row.status === 'CURRENT')
      .sort((a, b) => a.daysSinceAccess - b.daysSinceAccess || byName(a, b)).slice(0, 10),
    activities: result.deliveries.activityChart,
  };
}

function weeklyPoint(snapshot, filters) {
  const summary = semesterAnalysis(snapshot, filters).summary;
  const d = summary.deliveries;
  return { snapshotId: snapshot.id, generatedAt: snapshot.generatedAt, total: d.total,
    onTime: d.early + d.onTime + d.inherited, overdue: d.overdue,
    deliveredLate: d.deliveredLate, pending: d.pendingInTime, validation: d.validation,
  };
}

module.exports = { semesterAnalysis, weeklyPoint };
