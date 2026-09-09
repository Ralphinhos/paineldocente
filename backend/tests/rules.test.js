const test = require('node:test'); const assert = require('node:assert/strict'); const path = require('node:path'); const { createDemoSource } = require('../data/demoSource'); const { buildSnapshot, calculateAccess, loadCatalog, saoPauloDate } = require('../core/rules'); const { groupAssignments, modalityBreakdown, summarize, weeklySnapshots } = require('../services/dashboardService');
const catalog = loadCatalog(path.join(__dirname, '..', 'config', 'rules.json'));
const snapshot = () => { const raw = createDemoSource(new Date('2026-09-03T12:00:00.000Z'), 3); return buildSnapshot(raw, catalog, { rulesApproved: false, manualDeliveries: raw.manualDeliveries }); };
test('conclusão alterada não comprova entrega de Tarefa', () => { const row = snapshot().rows.find((x) => x.course.id === '1101' && x.requirement.id === 'desafio'); assert.equal(row.structureStatus, 'PENDING'); assert.equal(row.reasonCode, 'REQUIREMENT_OVERDUE'); assert.ok(row.evidence.some((e) => e.type === 'COMPLETION_CHANGED' && e.supports === 'ACCESS_ONLY')); });
test('curso restaurado pronto isenta estrutura e mantém acesso crítico', () => { const rows = snapshot().rows.filter((x) => x.course.id === '1102'); assert.ok(rows.every((x) => x.structureStatus === 'INHERITED_READY')); assert.ok(rows.every((x) => x.accessStatus === 'CRITICAL')); });
test('acesso é contado uma vez por docente e disciplina', () => { const result = summarize(snapshot().rows); assert.equal(Object.values(result.access).reduce((sum, value) => sum + value, 0), 6); assert.equal(result.monitoredTeachers, 6); });
test('snapshot tem chave única e bloqueia catálogo piloto', () => { const result = snapshot(); const keys = result.rows.map((x) => `${x.snapshotId}:${x.course.id}:${x.teacher.id}:${x.requirement.id}`); assert.equal(new Set(keys).size, keys.length); assert.equal(result.qualityStatus, 'BLOCKED'); assert.equal(result.publishAllowed, false); });
test('log de módulo atualizado não inventa data de entrega', () => {
  const raw = createDemoSource(new Date('2026-09-03T12:00:00.000Z'), 3); raw.source = 'moodle';
  const activity = raw.courses.find((course) => course.id === '1105').activities.find((item) => item.requirementId === 'forum_diagnostico');
  activity.configurationTimeSource = null; activity.deadlineSource = 'OFFICIAL_CATALOG';
  const row = buildSnapshot(raw, catalog, { rulesApproved: true, manualDeliveries: raw.manualDeliveries }).rows.find((item) => item.course.id === '1105' && item.requirement.id === 'forum_diagnostico');
  assert.equal(row.structureStatus, 'NOT_VERIFIABLE');
  assert.equal(row.reasonCode, 'CONFIGURATION_DATE_UNKNOWN');
  assert.ok(row.evidence.some((evidence) => evidence.type === 'MODULE_UPDATED'));
});
test('fotografias comprovam entrega tardia sem depender do log', () => {
  const raw = createDemoSource(new Date('2026-09-03T12:00:00.000Z'), 3); raw.source = 'moodle';
  for (const course of raw.courses) for (const activity of course.activities) { activity.configurationTimeSource = null; if (activity.deadlineAt) activity.deadlineSource = 'OFFICIAL_CATALOG'; }
  const activity = raw.courses.find((course) => course.id === '1105').activities.find((item) => item.requirementId === 'forum_diagnostico');
  activity.visible = false; activity.observedQuantity = 0; activity.configuredAt = null;
  const previous = buildSnapshot(raw, catalog, { rulesApproved: true, manualDeliveries: raw.manualDeliveries });
  const currentRaw = structuredClone(raw); currentRaw.generatedAt = '2026-09-04T12:00:00.000Z';
  const currentActivity = currentRaw.courses.find((course) => course.id === '1105').activities.find((item) => item.requirementId === 'forum_diagnostico');
  currentActivity.visible = true; currentActivity.observedQuantity = 4;
  const current = buildSnapshot(currentRaw, catalog, { rulesApproved: true, previousSnapshot: previous, manualDeliveries: currentRaw.manualDeliveries });
  const row = current.rows.find((item) => item.course.id === '1105' && item.requirement.id === 'forum_diagnostico');
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
test('faixas de acesso respeitam 0–7, 8–14 e 15+ dias', () => {
  const now = new Date('2026-09-20T12:00:00.000Z'); const course = { startsAt: '2026-08-01T00:00:00.000Z', endsAt: '2026-10-01T00:00:00.000Z' };
  const accessAt = (days) => calculateAccess({ lastAccessAt: new Date(now.getTime() - days * 86400000).toISOString(), accessEvents: [] }, course, now, catalog.accessThresholds).status;
  assert.equal(accessAt(7), 'CURRENT'); assert.equal(accessAt(8), 'ATTENTION'); assert.equal(accessAt(14), 'ATTENTION'); assert.equal(accessAt(15), 'CRITICAL');
});
test('UA e videoaula usam registros individuais do NED', () => {
  const result = snapshot();
  const ua4 = result.rows.find((item) => item.course.id === '1101' && item.requirement.id === 'unidades_aprendizagem:4');
  const video1 = result.rows.find((item) => item.course.id === '1101' && item.requirement.id === 'videos:1');
  assert.equal(ua4.structureStatus, 'DELIVERED_LATE'); assert.equal(ua4.timingSource, 'MANUAL_NED'); assert.equal(ua4.evidence[0].type, 'UA_SENT_BY_TEACHER');
  assert.equal(video1.structureStatus, 'DELIVERED_ON_TIME'); assert.equal(video1.evidence[0].type, 'VIDEO_RECORDED_BY_TEACHER');
});
test('publicação não altera a situação docente', () => {
  const raw = createDemoSource(new Date('2026-09-03T12:00:00.000Z'), 3);
  const record = raw.manualDeliveries.find((item) => item.courseId === '1101' && item.requirementId === 'videos' && item.itemNumber === 1);
  record.publishedDate = '2026-12-20';
  const row = buildSnapshot(raw, catalog, { rulesApproved: true, manualDeliveries: raw.manualDeliveries }).rows.find((item) => item.course.id === '1101' && item.requirement.id === 'videos:1');
  assert.equal(row.structureStatus, 'DELIVERED_ON_TIME'); assert.equal(row.publishedDate, '2026-12-20');
});
test('entrega manual no mesmo dia do prazo fica em dia', () => {
  const raw = createDemoSource(new Date('2026-09-03T12:00:00.000Z'), 3);
  const deadline = raw.courses.find((course) => course.id === '1101').activities.find((item) => item.requirementId === 'videos').deadlineAt;
  const record = raw.manualDeliveries.find((item) => item.courseId === '1101' && item.requirementId === 'videos' && item.itemNumber === 1);
  record.evidenceDate = saoPauloDate(deadline);
  const row = buildSnapshot(raw, catalog, { rulesApproved: true, manualDeliveries: raw.manualDeliveries }).rows.find((item) => item.course.id === '1101' && item.requirement.id === 'videos:1');
  assert.equal(row.structureStatus, 'DELIVERED_ON_TIME');
});
test('não aplicável sai do total e estrutura compartilhada não duplica', () => {
  const rows = snapshot().rows.filter((item) => item.course.id === '1104'); const result = summarize(rows);
  assert.equal(result.requirements.notApplicable, 16); assert.equal(result.requirements.total, 19);
  const breakdown = modalityBreakdown(rows); assert.deepEqual(breakdown.map((item) => item.total), [1]);
});
test('atraso concluído e dado não verificável não viram exceção docente atual', () => {
  const base = snapshot().rows.find((item) => item.course.id === '1105');
  const late = { ...base, requirement: { ...base.requirement, id: 'historico' }, structureStatus: 'DELIVERED_LATE', overdue: false };
  const unknown = { ...base, requirement: { ...base.requirement, id: 'qualidade' }, structureStatus: 'NOT_VERIFIABLE', overdue: false };
  const assignment = groupAssignments([late, unknown])[0];
  assert.equal(assignment.severity, 'OK'); assert.equal(assignment.issueCount, 0); assert.equal(assignment.dataQualityCount, 1);
});
test('tendência usa somente a última fotografia de cada semana', () => {
  const history = [
    { id: 'b', generatedAt: '2026-09-09T18:00:00.000Z' },
    { id: 'a', generatedAt: '2026-09-08T12:00:00.000Z' },
    { id: 'z', generatedAt: '2026-09-02T12:00:00.000Z' },
  ];
  assert.deepEqual(weeklySnapshots(history).map((item) => item.id), ['z', 'b']);
});
