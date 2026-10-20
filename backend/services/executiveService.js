const { HttpError } = require('../core/http');
const { pageRows } = require('../core/monitoring');
const { semesterAnalysis, weeklyPoint } = require('../core/executive');

class ExecutiveService {
  constructor({ store, snapshotIntervalMinutes }) { Object.assign(this, { store, snapshotIntervalMinutes }); this.historyCache = new Map(); }
  async context(filters) {
    const periods = await this.store.listSemesterPeriods();
    const period = filters.period || periods[0] || '';
    if (!period) throw new HttpError(503, 'SNAPSHOT_UNAVAILABLE', 'Ainda não há coleta disponível para análise semestral.');
    const metas = await this.store.listSemesterSnapshotMetas(period);
    const selected = filters.snapshotId ? metas.find((item) => item.id === filters.snapshotId) : metas[0];
    // A deep link can point to a collection superseded within the same week.
    const snapshot = selected ? await this.store.getSnapshot(selected.id, period)
      : filters.snapshotId ? await this.store.getSnapshot(filters.snapshotId, period) : null;
    if (!snapshot || !snapshot.rows.length) throw new HttpError(404, 'SEMESTER_UNAVAILABLE', 'Não há coleta para o semestre e a referência selecionados.');
    return { period, periods, metas, snapshot };
  }
  async getOverview(filters = {}) {
    const { period, periods, snapshot } = await this.context(filters);
    const analysis = semesterAnalysis(snapshot, { ...filters, period });
    const query = (filters.query || '').trim().toLocaleLowerCase('pt-BR');
    const table = analysis.teachers.filter((row) => !query || row.teacher.name.toLocaleLowerCase('pt-BR').includes(query));
    if (filters.sort === 'name') table.sort((a, b) => a.teacher.name.localeCompare(b.teacher.name, 'pt-BR'));
    if (filters.sort === 'access') table.sort((a, b) => (b.access.daysSinceAccess ?? -1) - (a.access.daysSinceAccess ?? -1));
    if (filters.sort === 'ontime') table.sort((a, b) => (b.onTimePercent ?? -1) - (a.onTimePercent ?? -1) || b.due - a.due);
    const modalities = [...new Map(snapshot.rows.map((row) => [row.course.modality, { value: row.course.modality, label: row.course.modalityLabel }])).values()];
    const deadlines = await this.store.latestDeadlineCatalog();
    return {
      meta: { snapshotId: snapshot.id, generatedAt: snapshot.generatedAt, period, modality: filters.modality || '', bimester: filters.bimester || '', source: snapshot.source,
        isDemo: snapshot.isDemo, qualityStatus: snapshot.qualityStatus, rulesVersion: snapshot.rulesVersion,
        rulesStatus: snapshot.rulesStatus, qualityIssues: snapshot.qualityIssues,
        stale: Date.now() - new Date(snapshot.generatedAt).getTime() > this.snapshotIntervalMinutes * 120000,
        deadlinesChanged: (deadlines?.id || null) !== (snapshot.deadlineVersionId || null),
      },
      filters: { periods, modalities }, summary: analysis.summary,
      topLate: analysis.topLate, topOnTime: analysis.topOnTime, topAbsent: analysis.topAbsent,
      topRecent: analysis.topRecent, activities: analysis.activities,
      teachers: pageRows(table, filters.page, 20),
    };
  }
  async getHistory(filters) {
    const cacheKey = JSON.stringify([filters.snapshotId, filters.period || '', filters.modality || '', filters.bimester || '']);
    if (this.historyCache.has(cacheKey)) return structuredClone(this.historyCache.get(cacheKey));
    const { period, snapshot, metas } = await this.context(filters);
    const compatible = metas.filter((meta) => new Date(meta.generatedAt) <= new Date(snapshot.generatedAt)
      && meta.rulesVersion === snapshot.rulesVersion && meta.source === snapshot.source
      && (meta.deadlineVersionId || null) === (snapshot.deadlineVersionId || null));
    const points = [];
    // Read one collection at a time: the response retains aggregates, never 26 full payloads.
    for (const meta of compatible.reverse()) {
      const current = meta.id === snapshot.id ? snapshot : await this.store.getSnapshot(meta.id, period);
      if (current) points.push(weeklyPoint(current, { ...filters, period }));
    }
    if (!points.some((point) => point.snapshotId === snapshot.id)) points.push(weeklyPoint(snapshot, { ...filters, period }));
    const result = { snapshotId: snapshot.id, points: points.sort((a, b) => new Date(a.generatedAt) - new Date(b.generatedAt)) };
    this.historyCache.set(cacheKey, structuredClone(result));
    if (this.historyCache.size > 8) this.historyCache.delete(this.historyCache.keys().next().value);
    return result;
  }
}
module.exports = { ExecutiveService };
