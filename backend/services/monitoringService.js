const { HttpError } = require('../core/http');
const { buildMonitoring, pageRows } = require('../core/monitoring');
const { allowedRows } = require('./dashboardService');

function monitoringFilters(rows) {
  const pairs = (key, label) => [...new Map(rows.map((row) => [row[key].id, { value: row[key].id, label: label(row[key]) }])).values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  return {
    periods: [...new Set(rows.map((row) => row.course.period))].sort().reverse(),
    modalities: [...new Map(rows.map((row) => [row.course.modality, { value: row.course.modality, label: row.course.modalityLabel }])).values()],
    courses: pairs('course', (course) => `${course.name} · ${course.shortName}`),
    teachers: pairs('teacher', (teacher) => teacher.name),
  };
}

class MonitoringService {
  constructor({ store, snapshotIntervalMinutes }) { Object.assign(this, { store, snapshotIntervalMinutes }); }
  async getMonitoring(user, filters = {}, options = {}) {
    const snapshot = options.snapshot || await this.store.latestSnapshot();
    if (!snapshot) throw new HttpError(503, 'SNAPSHOT_UNAVAILABLE', 'Ainda não há coleta disponível.');
    const scoped = allowedRows(snapshot, user);
    const query = String(filters.query || '').trim().toLocaleLowerCase('pt-BR');
    const rows = scoped.filter((row) => !(filters.period && row.course.period !== filters.period)
      && !(filters.modality && row.course.modality !== filters.modality)
      && !(filters.courseId && row.course.id !== String(filters.courseId))
      && !(filters.teacherId && row.teacher.id !== String(filters.teacherId))
      && !(query && !`${row.teacher.name} ${row.course.name} ${row.course.shortName}`.toLocaleLowerCase('pt-BR').includes(query)));
    const result = buildMonitoring(rows, snapshot.generatedAt);
    const accessStatus = filters.accessStatus || 'ISSUES';
    const deliveryStatus = filters.deliveryStatus || 'OVERDUE';
    const accessRows = result.access.rows.filter((row) => accessStatus === 'ALL' || (accessStatus === 'ISSUES' ? row.status !== 'CURRENT' : row.status === accessStatus));
    const deliveryRows = result.deliveries.rows.filter((row) => (!filters.activityKey || `${row.course.modality}:${row.item.id}` === filters.activityKey)
      && (deliveryStatus === 'ALL' || (deliveryStatus === 'COMPLIANT' ? ['EARLY', 'ON_TIME', 'INHERITED_READY'].includes(row.displayStatus) : deliveryStatus === 'ON_TIME_OR_INHERITED' ? ['ON_TIME', 'INHERITED_READY'].includes(row.displayStatus) : row.displayStatus === deliveryStatus)));
    const issues = snapshot.qualityIssues.filter((issue) => user.role !== 'coordinator' || !issue.courseId || user.courseIds.includes(issue.courseId));
    const invalid = result.access.summary.validation + result.deliveries.summary.validation;
    return {
      meta: { snapshotId: snapshot.id, generatedAt: snapshot.generatedAt, source: snapshot.source, isDemo: snapshot.isDemo, rulesVersion: snapshot.rulesVersion, rulesStatus: snapshot.rulesStatus, qualityStatus: snapshot.qualityStatus, publishAllowed: snapshot.publishAllowed && invalid === 0, stale: Date.now() - new Date(snapshot.generatedAt).getTime() > this.snapshotIntervalMinutes * 120000, qualityIssues: issues },
      filters: monitoringFilters(scoped),
      access: { ...result.access, ...(options.allRows ? {} : pageRows(accessRows, filters.page, filters.pageSize)) },
      deliveries: { ...result.deliveries, ...(options.allRows ? {} : pageRows(deliveryRows, filters.page, filters.pageSize)) },
    };
  }
}

module.exports = { MonitoringService, monitoringFilters };
