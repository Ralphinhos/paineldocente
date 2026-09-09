const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createDemoSource } = require('../data/demoSource');
const { buildSnapshot, loadCatalog } = require('../core/rules');
const { validateSnapshot } = require('../scripts/validate-snapshot');

const catalog = loadCatalog(path.join(__dirname, '..', 'config', 'rules.json'));

test('validador aceita invariantes da fotografia demonstrativa', () => {
  const snapshot = buildSnapshot(createDemoSource(new Date('2026-06-23T12:00:00.000Z')), catalog, { rulesApproved: false });
  assert.deepEqual(validateSnapshot(snapshot), []);
});

test('validador rejeita conclusão tratada como entrega', () => {
  const snapshot = buildSnapshot(createDemoSource(new Date('2026-06-23T12:00:00.000Z')), catalog, { rulesApproved: false });
  const evidence = snapshot.rows.flatMap((row) => row.evidence).find((item) => item.type === 'COMPLETION_CHANGED');
  evidence.supports = 'TEACHER_INTERACTION';
  assert.ok(validateSnapshot(snapshot).some((item) => item.startsWith('COMPLETION_MISCLASSIFIED:')));
});

test('validador aceita nova versão manual em estrutura herdada', () => {
  const raw = createDemoSource(new Date('2026-09-03T12:00:00.000Z'));
  raw.source = 'moodle';
  for (const course of raw.courses) for (const activity of course.activities) { if (activity.deadlineAt) activity.deadlineSource = 'OFFICIAL_CATALOG'; activity.configurationTimeSource = null; }
  raw.manualDeliveries.push({ courseId: '1102', teacherId: '502', requirementId: 'unidades_aprendizagem', itemNumber: 1, revision: 2, disposition: 'PENDING', evidenceDate: null, publishedDate: null, justification: null, replacementReason: 'Troca do pacote de UAs.', revisionDeadlineDate: '2026-09-20', updatedBy: 'Equipe NED', updatedAt: '2026-09-03T12:00:00.000Z' });
  const snapshot = buildSnapshot(raw, catalog, { rulesApproved: true, manualDeliveries: raw.manualDeliveries });
  assert.deepEqual(validateSnapshot(snapshot), []);
});
