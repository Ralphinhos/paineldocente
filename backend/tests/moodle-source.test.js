const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeRows } = require('../data/moodleSource');

const generatedAt = '2026-09-03T12:00:00.000Z';
const deadlines = { version: 'test', periods: { '2026/2': { MODULAR: { defaults: { desafio: '2026-08-01T12:00:00.000Z' } } } } };
function row(overrides = {}) {
  return {
    course_id: 10, course_name: 'Projeto Integrador', course_shortname: 'PI-2026-2-40H', startdate: 1782864000, enddate: 1798675200,
    originalcourseid: null, course_created_at: 1782864000, category_name: 'Tecnologia', modality_field_value: 'Modular', category_field_value: null, workload_value: '40h',
    teacher_id: 20, teacher_name: 'Docente Teste', teacher_email: 'docente@example.invalid', assigned_at: 1782864000, last_access_at: 1782864000,
    cm_id: 30, module_name: 'assign', activity_name: 'Desafio', activity_visible: 1, module_updated_at: 1783000000, completion_updated_at: 1783100000, completion_related_user_id: 99, module_viewed_at: 1783200000,
    ...overrides,
  };
}

test('normalização preserva logs sem inventar data de configuração', () => {
  const source = normalizeRows([row()], generatedAt, deadlines);
  const activity = source.courses[0].activities[0];
  assert.equal(activity.deadlineSource, 'OFFICIAL_CATALOG');
  assert.equal(activity.configuredAt, null);
  assert.equal(activity.configurationTimeSource, null);
  assert.ok(activity.events.some((event) => event.name === '\\core\\event\\course_module_completion_updated' && event.relatedUserId === '99'));
  assert.ok(source.courses[0].teachers[0].accessEvents.some((event) => event.name === '\\core\\event\\course_module_completion_updated'));
});

test('normalização bloqueia conflitos e requisito singular duplicado', () => {
  const source = normalizeRows([
    row({ category_field_value: 'Semestral', workload_value: '80h' }),
    row({ cm_id: 31, category_field_value: 'Semestral', workload_value: '80h' }),
  ], generatedAt, deadlines);
  assert.ok(source.sourceIssues.some((issue) => issue.code === 'MODALITY_CONFLICT'));
  assert.ok(source.sourceIssues.some((issue) => issue.code === 'WORKLOAD_CONFLICT'));
  assert.equal(source.courses[0].activities[0].mappingConfidence, 'AMBIGUOUS');
});

test('rótulo de vídeo mantém prazos individuais sem usar edição como entrega', () => {
  const manualDeadlines = { version: 'test', periods: { '2026/2': { MODULAR: { defaults: { videos: ['2026-08-01T02:59:59.000Z', '2026-08-08T02:59:59.000Z'] } } } } };
  const source = normalizeRows([row({ module_name: 'label', activity_name: 'Videoaula 1' })], generatedAt, manualDeadlines);
  const course = source.courses[0]; const activity = course.activities[0];
  assert.deepEqual(course.requirementDeadlines.videos, manualDeadlines.periods['2026/2'].MODULAR.defaults.videos);
  assert.equal(activity.requirementId, 'videos'); assert.equal(activity.deadlineAt, '2026-08-01T02:59:59.000Z'); assert.equal(activity.configuredAt, null);
});
