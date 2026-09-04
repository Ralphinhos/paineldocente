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
