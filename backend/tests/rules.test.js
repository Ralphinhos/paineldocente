const test = require('node:test'); const assert = require('node:assert/strict'); const path = require('node:path'); const { createDemoSource } = require('../data/demoSource'); const { buildSnapshot, calculateAccess, loadCatalog } = require('../core/rules'); const { summarize } = require('../services/dashboardService');
const catalog = loadCatalog(path.join(__dirname, '..', 'config', 'rules.json'));
const snapshot = () => buildSnapshot(createDemoSource(new Date('2026-09-03T12:00:00.000Z'), 3), catalog, { rulesApproved: false });
test('conclusão alterada não comprova entrega de Tarefa', () => { const row = snapshot().rows.find((x) => x.course.id === '1101' && x.requirement.id === 'desafio'); assert.equal(row.structureStatus, 'PENDING'); assert.equal(row.reasonCode, 'REQUIREMENT_OVERDUE'); assert.ok(row.evidence.some((e) => e.type === 'COMPLETION_CHANGED' && e.supports === 'ACCESS_ONLY')); });
test('curso restaurado pronto isenta estrutura e mantém acesso crítico', () => { const rows = snapshot().rows.filter((x) => x.course.id === '1102'); assert.ok(rows.every((x) => x.structureStatus === 'INHERITED_READY')); assert.ok(rows.every((x) => x.accessStatus === 'CRITICAL')); });
test('acesso é contado uma vez por docente e disciplina', () => { const result = summarize(snapshot().rows); assert.equal(Object.values(result.access).reduce((sum, value) => sum + value, 0), 6); assert.equal(result.monitoredTeachers, 6); });
test('snapshot tem chave única e bloqueia catálogo piloto', () => { const result = snapshot(); const keys = result.rows.map((x) => `${x.snapshotId}:${x.course.id}:${x.teacher.id}:${x.requirement.id}`); assert.equal(new Set(keys).size, keys.length); assert.equal(result.qualityStatus, 'BLOCKED'); assert.equal(result.publishAllowed, false); });
test('log de módulo atualizado não inventa data de entrega', () => {
  const raw = createDemoSource(new Date('2026-09-03T12:00:00.000Z'), 3); raw.source = 'moodle';
  const activity = raw.courses.find((course) => course.id === '1105').activities.find((item) => item.requirementId === 'videos');
  activity.configurationTimeSource = null; activity.deadlineSource = 'OFFICIAL_CATALOG';
  const row = buildSnapshot(raw, catalog, { rulesApproved: true }).rows.find((item) => item.course.id === '1105' && item.requirement.id === 'videos');
  assert.equal(row.structureStatus, 'NOT_VERIFIABLE');
  assert.equal(row.reasonCode, 'CONFIGURATION_DATE_UNKNOWN');
  assert.ok(row.evidence.some((evidence) => evidence.type === 'MODULE_UPDATED'));
});
test('fotografias comprovam entrega tardia sem depender do log', () => {
  const raw = createDemoSource(new Date('2026-09-03T12:00:00.000Z'), 3); raw.source = 'moodle';
  for (const course of raw.courses) for (const activity of course.activities) { activity.configurationTimeSource = null; if (activity.deadlineAt) activity.deadlineSource = 'OFFICIAL_CATALOG'; }
  const activity = raw.courses.find((course) => course.id === '1105').activities.find((item) => item.requirementId === 'videos');
  activity.visible = false; activity.observedQuantity = 0; activity.configuredAt = null;
  const previous = buildSnapshot(raw, catalog, { rulesApproved: true });
  const currentRaw = structuredClone(raw); currentRaw.generatedAt = '2026-09-04T12:00:00.000Z';
  const currentActivity = currentRaw.courses.find((course) => course.id === '1105').activities.find((item) => item.requirementId === 'videos');
  currentActivity.visible = true; currentActivity.observedQuantity = 4;
  const current = buildSnapshot(currentRaw, catalog, { rulesApproved: true, previousSnapshot: previous });
  const row = current.rows.find((item) => item.course.id === '1105' && item.requirement.id === 'videos');
  assert.equal(row.structureStatus, 'DELIVERED_LATE');
  assert.equal(row.timingSource, 'SNAPSHOT_OBSERVED');
  assert.equal(row.reasonCode, 'READY_OBSERVED_AFTER_OVERDUE');
});
test('conclusão alterada conta como acesso sem contar como entrega', () => {
  const now = new Date('2026-09-03T12:00:00.000Z');
  const access = calculateAccess({ lastAccessAt: null, accessEvents: [{ name: '\\core\\event\\course_module_completion_updated', occurredAt: '2026-09-02T12:00:00.000Z' }] }, { startsAt: '2026-08-01T00:00:00.000Z', endsAt: '2026-10-01T00:00:00.000Z' }, now, catalog.accessThresholds);
  assert.equal(access.status, 'CURRENT');
  assert.equal(access.lastAccessAt, '2026-09-02T12:00:00.000Z');
});
