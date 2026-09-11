const { HttpError } = require('../core/http');
const { delayFacts, delayLabel, saoPauloDate } = require('../core/timing');
const { teacherRanking } = require('../core/ranking');
const ORDER = { CRITICAL: 0, ATTENTION: 1, OK: 2 };
const STRUCTURE_ORDER = { NOT_VERIFIABLE: 0, PENDING_OVERDUE: 1, PENDING: 2, DELIVERED_LATE: 3, DELIVERED_ON_TIME: 4, INHERITED_READY: 5, NOT_APPLICABLE: 6 };
function allowedRows(snapshot, user) { if (user.role !== 'coordinator') return snapshot.rows; const scope = new Set(user.courseIds.map(String)); return snapshot.rows.filter((row) => scope.has(row.course.id)); }
function distinctStructureRows(rows) {
  const structures = new Map();
  for (const row of rows) {
    if (row.requirement.responsibility === 'OTHER_TEACHER') continue;
    const key = `${row.course.id}:${row.requirement.id}`;
    const rank = STRUCTURE_ORDER[row.structureStatus === 'PENDING' && row.overdue ? 'PENDING_OVERDUE' : row.structureStatus] ?? 99;
    const current = structures.get(key);
    if (!current || rank < current.rank) structures.set(key, { row, rank });
  }
  return [...structures.values()].map((item) => item.row);
}
function summarize(rows) {
  const teachers = new Set(); const courses = new Set(); const access = new Map(); const requirements = { total: 0, pending: 0, overdue: 0, deliveredLate: 0, deliveredOnTime: 0, inheritedReady: 0, notApplicable: 0, notVerifiable: 0 };
  for (const row of rows) { teachers.add(row.teacher.id); courses.add(row.course.id); access.set(`${row.course.id}:${row.teacher.id}`, row.accessStatus); }
  for (const row of distinctStructureRows(rows)) { if (row.structureStatus !== 'NOT_APPLICABLE') requirements.total += 1; if (row.structureStatus === 'PENDING') requirements.pending += 1; if (row.structureStatus === 'PENDING' && row.overdue) requirements.overdue += 1; if (row.structureStatus === 'DELIVERED_LATE') requirements.deliveredLate += 1; if (row.structureStatus === 'DELIVERED_ON_TIME') requirements.deliveredOnTime += 1; if (row.structureStatus === 'INHERITED_READY') requirements.inheritedReady += 1; if (row.structureStatus === 'NOT_APPLICABLE') requirements.notApplicable += 1; if (row.structureStatus === 'NOT_VERIFIABLE') requirements.notVerifiable += 1; }
  const accessSummary = { current: 0, attention: 0, critical: 0, never: 0, outsideWindow: 0 };
  for (const status of access.values()) { if (status === 'CURRENT') accessSummary.current += 1; if (status === 'ATTENTION') accessSummary.attention += 1; if (status === 'CRITICAL') accessSummary.critical += 1; if (status === 'NEVER') accessSummary.never += 1; if (status === 'OUTSIDE_WINDOW') accessSummary.outsideWindow += 1; }
  const late = distinctStructureRows(rows).filter((row) => row.structureStatus === 'DELIVERED_LATE');
  const exact = late.filter((row) => row.daysLate != null);
  return { monitoredTeachers: teachers.size, courses: courses.size, requirements, access: accessSummary, averageDaysLate: exact.length ? Math.round(exact.reduce((sum, row) => sum + row.daysLate, 0) / exact.length * 10) / 10 : late.length ? null : 0, measuredLateItems: exact.length, unmeasuredLateItems: late.length - exact.length };
}
function groupAssignments(rows) {
  const groups = new Map();
  for (const row of rows) { const key = `${row.course.id}:${row.teacher.id}`; const group = groups.get(key) || { id: key, course: row.course, teacher: row.teacher, accessStatus: row.accessStatus, lastAccessAt: row.lastAccessAt, daysSinceAccess: row.daysSinceAccess, provenance: row.provenance, requirements: [] }; group.requirements.push({ ...row.requirement, ...delayFacts(row, row.calculatedAt), status: row.structureStatus, reasonCode: row.reasonCode, reason: row.reason, overdue: row.overdue, deadlineAt: row.deadlineAt, deadlineSource: row.deadlineSource, configuredAt: row.configuredAt, timingSource: row.timingSource, expectedQuantity: row.expectedQuantity, observedQuantity: row.observedQuantity, evidence: row.evidence, manualEvidenceDate: row.manualEvidenceDate || null, publishedDate: row.publishedDate || null, manualJustification: row.manualJustification || null, manualUpdatedBy: row.manualUpdatedBy || null, manualUpdatedAt: row.manualUpdatedAt || null, manualVersion: row.manualVersion || null, manualReplacementReason: row.manualReplacementReason || null, manualRevisionDeadlineDate: row.manualRevisionDeadlineDate || null }); groups.set(key, group); }
  return [...groups.values()].map((group) => {
    const pending = group.requirements.filter((item) => item.status === 'PENDING' && item.overdue && item.responsibility !== 'OTHER_TEACHER').sort((a, b) => (b.daysLate || 0) - (a.daysLate || 0));
    const unverifiable = group.requirements.filter((item) => item.status === 'NOT_VERIFIABLE' && item.responsibility !== 'OTHER_TEACHER');
    const late = group.requirements.filter((item) => item.status === 'DELIVERED_LATE' && item.responsibility !== 'OTHER_TEACHER');
    const accessCritical = ['CRITICAL', 'NEVER'].includes(group.accessStatus);
    const severity = accessCritical || pending.length ? 'CRITICAL' : group.accessStatus === 'ATTENTION' ? 'ATTENTION' : 'OK';
    const first = pending[0] || late[0];
    const primaryReason = pending.length ? `${pending[0].responsibility === 'UNCONFIRMED' ? 'Responsável a definir · ' : ''}${pending[0].label} · ${delayLabel(pending[0])}` : accessCritical || group.accessStatus === 'ATTENTION' ? group.accessStatus === 'NEVER' ? 'Sem acesso registrado' : `Acesso há ${group.daysSinceAccess} dias` : first ? `${first.label} · ${delayLabel(first)}` : unverifiable.length ? 'Dados a validar' : 'Em dia';
    return { ...group, severity, issueCount: pending.length, dataQualityCount: unverifiable.length, primaryReason, maxDaysLate: Math.max(0, ...pending.map((item) => item.daysLate || 0), ...late.map((item) => item.daysLate || 0)) };
  });
}
function filterRows(rows, filters) {
  const query = String(filters.query || '').trim().toLocaleLowerCase('pt-BR');
  return rows.filter((row) => !(filters.period && row.course.period !== filters.period) && !(filters.modality && row.course.modality !== filters.modality) && !(filters.courseId && row.course.id !== String(filters.courseId)) && !(filters.teacherId && row.teacher.id !== String(filters.teacherId)) && !(query && !`${row.course.name} ${row.course.shortName} ${row.teacher.name}`.toLocaleLowerCase('pt-BR').includes(query)));
}
function matchesStatus(assignment, filter) {
  const statuses = String(filter || '').split(',').filter(Boolean);
  return !statuses.length || statuses.includes(assignment.accessStatus) || assignment.requirements.some((item) => statuses.includes(item.status) || statuses.includes('OVERDUE') && item.status === 'PENDING' && item.overdue);
}
function scopedIssues(snapshot, user) { if (user.role !== 'coordinator') return snapshot.qualityIssues; const scope = new Set(user.courseIds.map(String)); return snapshot.qualityIssues.filter((issue) => !issue.courseId || scope.has(String(issue.courseId))); }
function filterOptions(rows) { const unique = (values) => [...new Set(values)].sort((a, b) => a.localeCompare(b, 'pt-BR')); return { periods: unique(rows.map((row) => row.course.period)), modalities: unique(rows.map((row) => row.course.modality)).map((value) => ({ value, label: rows.find((row) => row.course.modality === value).course.modalityLabel })), courses: [...new Map(rows.map((row) => [row.course.id, { value: row.course.id, label: row.course.shortName }])).values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')) }; }
function modalityBreakdown(rows) { const courses = new Map(); for (const assignment of groupAssignments(rows)) { const item = courses.get(assignment.course.id) || { modality: assignment.course.modality, label: assignment.course.modalityLabel, issue: false }; item.issue ||= assignment.severity !== 'OK'; courses.set(assignment.course.id, item); } const map = new Map(); for (const course of courses.values()) { const group = map.get(course.modality) || { modality: course.modality, label: course.label, total: 0, issues: 0 }; group.total += 1; if (course.issue) group.issues += 1; map.set(course.modality, group); } return [...map.values()].map((item) => ({ ...item, compliant: item.total - item.issues })); }
function weeklySnapshots(history) {
  const seen = new Set(); const selected = [];
  for (const snapshot of [...history].sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt))) {
    const date = new Date(`${saoPauloDate(snapshot.generatedAt)}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
    const week = date.toISOString().slice(0, 10);
    if (seen.has(week)) continue;
    seen.add(week); selected.push(snapshot); if (selected.length === 8) break;
  }
  return selected.reverse();
}
class DashboardService {
  constructor({ store, snapshotIntervalMinutes }) { this.store = store; this.snapshotIntervalMinutes = snapshotIntervalMinutes; }
  async getDashboard(user, filters = {}, options = {}) {
    const snapshot = options.snapshot || await this.store.latestSnapshot();
    if (!snapshot) throw new HttpError(503, 'SNAPSHOT_UNAVAILABLE', 'Ainda não há coleta disponível.');
    const scoped = allowedRows(snapshot, user);
    const filtered = filterRows(scoped, filters);
    const allAssignments = groupAssignments(filtered);
    const assignments = allAssignments.filter((row) => matchesStatus(row, filters.status)).sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || b.maxDaysLate - a.maxDaysLate || (b.daysSinceAccess ?? -1) - (a.daysSinceAccess ?? -1) || a.course.shortName.localeCompare(b.course.shortName, 'pt-BR'));
    const pageSize = Math.max(5, Math.min(Number(filters.pageSize) || 20, 50));
    const pages = Math.max(1, Math.ceil(assignments.length / pageSize));
    const page = Math.min(pages, Math.max(1, Number(filters.page) || 1));
    const history = weeklySnapshots((await this.store.listSnapshots(52)).filter((item) => item.rulesVersion === snapshot.rulesVersion && item.source === snapshot.source && new Date(item.generatedAt) <= new Date(snapshot.generatedAt)));
    const trend = history.map((item) => {
      const historical = groupAssignments(filterRows(allowedRows(item, user), filters));
      return { generatedAt: item.generatedAt, critical: historical.filter((row) => row.severity === 'CRITICAL').length, attention: historical.filter((row) => row.severity === 'ATTENTION').length };
    });
    const issues = scopedIssues(snapshot, user); const ageMinutes = Math.floor((Date.now() - new Date(snapshot.generatedAt)) / 60000);
    const ranking = teacherRanking(allAssignments, snapshot.generatedAt, snapshot.rows[0]?.rankingPolicy);
    return {
      meta: { snapshotId: snapshot.id, generatedAt: snapshot.generatedAt, source: snapshot.source, isDemo: snapshot.isDemo, rulesVersion: snapshot.rulesVersion, rulesStatus: snapshot.rulesStatus, qualityStatus: issues.some((issue) => issue.severity === 'CRITICAL') ? 'BLOCKED' : snapshot.qualityStatus, publishAllowed: snapshot.publishAllowed, stale: ageMinutes > this.snapshotIntervalMinutes * 2, qualityIssues: issues },
      summary: summarize(filtered), ranking, trend, modalityBreakdown: modalityBreakdown(filtered),
      rows: options.allRows ? assignments : assignments.slice((page - 1) * pageSize, page * pageSize),
      filters: filterOptions(scoped), pagination: { page, pageSize, total: assignments.length, pages },
    };
  }
}
module.exports = { DashboardService, allowedRows, distinctStructureRows, groupAssignments, modalityBreakdown, summarize, weeklySnapshots };
