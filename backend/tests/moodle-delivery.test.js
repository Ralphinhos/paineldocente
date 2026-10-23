const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { normalizeRows } = require('../data/moodleSource');
const { buildSnapshot, loadCatalog } = require('../core/rules');
const { buildMonitoring } = require('../core/monitoring');
const { groupAssignments } = require('../services/dashboardService');
const { validateSnapshot } = require('../scripts/validate-snapshot');
const { pilotEvidenceReport } = require('../core/moodle-evidence');

const generatedAt = '2026-10-23T15:00:00.000Z';
const unix = (value) => Date.parse(value) / 1000;
const catalog = loadCatalog(path.join(__dirname, '../config/rules.json'));
const deadlines = { version: 'test', periods: { '2026/2': { GRADUACAO_EAD: { defaults: {
  unidades_aprendizagem: '2026-08-03T15:00:00.000Z', videos: '2026-08-03T15:00:00.000Z',
  forum_diagnostico: '2026-08-10T15:00:00.000Z', desafio: '2026-08-24T15:00:00.000Z', avaliacao_final: '2026-09-21T15:00:00.000Z',
} } } } };
function row(overrides = {}) {
  return { course_id: '10', course_name: 'Disciplina de teste', course_shortname: 'TESTE-2026-2-40H', startdate: unix('2026-07-01T15:00:00Z'), enddate: unix('2026-12-01T15:00:00Z'),
    originalcourseid: null, course_created_at: unix('2025-11-01T15:00:00Z'), category_name: 'Graduação EaD', modality_field_value: 'Graduação EaD', workload_value: '40h',
    teacher_id: '20', teacher_name: 'Docente de teste', teacher_email: 'docente@example.invalid', assigned_at: unix('2026-07-01T15:00:00Z'), environment_last_access_at: unix('2026-10-22T15:00:00Z'),
    cm_id: '30', module_name: 'assign', activity_name: 'Desafio', activity_visible: 1, cm_created_at: unix('2025-11-24T15:00:00Z'),
    activity_modified_at: unix('2026-08-24T15:00:00Z'), activity_description_present: 1, activity_content: '<p>Enunciado da atividade.</p>',
    first_update_log_at: unix('2026-08-23T15:00:00Z'), last_update_log_at: unix('2026-08-24T15:00:01Z'), module_updated_at: unix('2026-08-23T15:00:00Z'),
    completion_updated_at: unix('2026-08-23T15:00:00Z'), ...overrides };
}
function snapshot(rows, options = {}, dates = deadlines, at = generatedAt) {
  return buildSnapshot(normalizeRows(rows, at, dates), catalog, { rulesApproved: false, ...options });
}
const item = (value, id = 'desafio') => value.rows.find((entry) => entry.requirement.id === id);

test('Tarefa é selecionada antes do LTI de mesmo nome, independentemente da ordem', () => {
  const assignment = row(); const external = row({ cm_id: '31', module_name: 'lti', activity_content: null });
  for (const candidates of [[external, assignment], [assignment, external]]) {
    const raw = normalizeRows(candidates, generatedAt, deadlines); const activity = raw.courses[0].activities[0];
    assert.equal(activity.mappingConfidence, 'EXACT'); assert.equal(activity.observedQuantity, 1);
    assert.equal(raw.courses[0].moodleActivityFacts.find((fact) => fact.module === 'lti').selection, 'excluded');
    const result = item(buildSnapshot(raw, catalog, { rulesApproved: false }));
    assert.equal(result.structureStatus, 'DELIVERED_ON_TIME'); assert.equal(result.readyByAt, '2026-08-24T15:00:01.000Z');
    assert.equal(result.configuredAt, null); assert.equal(result.daysLate, 0); assert.equal(result.timingSource, 'MOODLE_READY_BY_BOUND');
    assert.match(pilotEvidenceReport(raw, 90).join('\n'), /excluído: há atividade do tipo esperado/);
  }
});

test('dois módulos do tipo esperado continuam ambíguos; LTI isolado não vira falta docente', () => {
  assert.equal(item(snapshot([row(), row({ cm_id: '32' })])).reasonCode, 'AMBIGUOUS_MAPPING');
  const unsupported = item(snapshot([row({ module_name: 'lti' })]));
  assert.equal(unsupported.structureStatus, 'NOT_VERIFIABLE'); assert.equal(unsupported.reasonCode, 'ACTIVITY_TYPE_UNSUPPORTED');
  const conflict = item(snapshot([row({ activity_visible: 0 }), row({ cm_id: '31', module_name: 'lti' })]));
  assert.equal(conflict.reasonCode, 'AMBIGUOUS_MAPPING');
});

test('metadado isolado, conclusão e visualização não comprovam data de entrega', () => {
  const result = item(snapshot([row({ last_update_log_at: null, module_updated_at: null, module_viewed_at: unix('2026-08-24T15:00:00Z') })]));
  assert.equal(result.structureStatus, 'NOT_VERIFIABLE'); assert.equal(result.reasonCode, 'CONFIGURATION_DATE_UNKNOWN');
  assert.ok(result.evidence.some((evidence) => evidence.type === 'COMPLETION_CHANGED' && evidence.supports === 'ACCESS_ONLY'));
});

test('conteúdo vazio em HTML não é promovido a entregue por existir módulo visível', () => {
  const future = structuredClone(deadlines); future.periods['2026/2'].GRADUACAO_EAD.defaults.desafio = '2026-12-01T15:00:00.000Z';
  for (const content of ['<p><br></p>', '<p>&nbsp;&#32;&#xA0;\u200b</p>', '<style>texto</style><script>texto</script>']) {
    const result = item(snapshot([row({ activity_content: content })], {}, future));
    assert.equal(result.structureStatus, 'NOT_VERIFIABLE'); assert.equal(result.reasonCode, 'PREPARATION_NOT_CONFIRMED');
  }
});

test('fórum usa o tópico inicial do docente mesmo sem descrição na instância', () => {
  const forum = row({ cm_id: '40', module_name: 'forum', activity_name: 'Fórum diagnóstico', activity_content: '', activity_description_present: 0,
    activity_modified_at: unix('2026-07-07T15:00:00Z'), last_update_log_at: null, forum_starter_id: '50', forum_starter_author_id: '20',
    forum_starter_created_at: unix('2026-08-10T15:00:00Z'), forum_starter_modified_at: unix('2026-08-10T15:00:00Z'), forum_starter_content: '<p>Tema para discussão.</p>' });
  const current = snapshot([forum]); const result = item(current, 'forum_diagnostico');
  assert.equal(result.structureStatus, 'DELIVERED_ON_TIME'); assert.equal(result.readyByAt, '2026-08-10T15:00:00.000Z');
  assert.deepEqual(validateSnapshot(current), []);
  const edited = item(snapshot([{ ...forum, forum_starter_modified_at: unix('2026-08-20T15:00:00Z') }]), 'forum_diagnostico');
  assert.equal(edited.structureStatus, 'NOT_VERIFIABLE'); assert.equal(edited.overdue, false);
  const otherAuthor = item(snapshot([{ ...forum, forum_starter_author_id: '99' }]), 'forum_diagnostico');
  assert.equal(otherAuthor.structureStatus, 'NOT_VERIFIABLE');
});

test('uso concluído, conclusão e contagem da avaliação não definem criação/importação docente', () => {
  const quiz = row({ cm_id: '60', module_name: 'quiz', activity_name: 'Avaliação final', activity_modified_at: unix('2026-07-07T15:00:00Z'), last_update_log_at: null,
    question_slot_count: 10, quiz_completed_attempts: 5, quiz_first_finished_at: unix('2026-09-20T15:00:00Z') });
  const current = snapshot([quiz]); const result = item(current, 'avaliacao_final');
  assert.equal(result.structureStatus, 'NOT_VERIFIABLE'); assert.equal(result.readyByAt, null);
  assert.deepEqual(validateSnapshot(current), []);
  for (const changes of [{ quiz_completed_attempts: 0, quiz_first_finished_at: null }, { quiz_first_finished_at: unix('2026-09-23T15:00:00Z') }, { quiz_first_finished_at: unix('2026-06-01T15:00:00Z') }, { question_slot_count: 0 }]) {
    const unresolved = item(snapshot([{ ...quiz, ...changes }]), 'avaliacao_final');
    assert.equal(unresolved.structureStatus, 'NOT_VERIFIABLE'); assert.equal(unresolved.overdue, false);
  }
});

test('edição posterior ao prazo permanece a validar e prova anterior continua preservada', () => {
  const previous = snapshot([row()]);
  const later = row({ activity_modified_at: unix('2026-09-01T15:00:00Z'), last_update_log_at: unix('2026-09-01T15:00:01Z') });
  assert.equal(item(snapshot([later])).structureStatus, 'NOT_VERIFIABLE');
  const current = snapshot([later], { previousSnapshot: previous });
  assert.equal(item(current).structureStatus, 'DELIVERED_ON_TIME'); assert.equal(item(current).readyByAt, item(previous).readyByAt);
  assert.deepEqual(validateSnapshot(current), []);
  const newDates = structuredClone(deadlines); newDates.periods['2026/2'].GRADUACAO_EAD.defaults.desafio = '2026-08-20T15:00:00.000Z';
  assert.equal(item(snapshot([later], { previousSnapshot: previous }, newDates)).structureStatus, 'NOT_VERIFIABLE');
});

test('validador recusa limite usado como atraso, data exata, data futura ou prova sem origem', () => {
  const current = snapshot([row()]);
  assert.deepEqual(validateSnapshot(current), []);
  for (const changes of [{ structureStatus: 'DELIVERED_LATE' }, { configuredAt: item(current).readyByAt }, { readyByAt: '2027-01-01T15:00:00Z' }, { readyByAt: 'inválida' }, { evidence: [] }]) {
    const invalid = structuredClone(current); Object.assign(item(invalid), changes);
    assert.ok(validateSnapshot(invalid).some((error) => error.startsWith('MOODLE_BOUND_INVALID:')));
  }
});

test('comprovação até data não vira antecipação, e o limite chega às duas respostas de detalhamento', () => {
  const current = snapshot([row({ activity_modified_at: unix('2026-08-20T15:00:00Z'), last_update_log_at: unix('2026-08-20T15:00:01Z') })]);
  const monitored = buildMonitoring(current.rows, generatedAt).deliveries.rows.find((entry) => entry.item.id === 'desafio');
  assert.equal(monitored.displayStatus, 'ON_TIME'); assert.equal(monitored.item.configuredAt, null);
  assert.equal(monitored.item.readyByAt, item(current).readyByAt);
  assert.equal(groupAssignments(current.rows)[0].requirements.find((entry) => entry.id === 'desafio').readyByAt, item(current).readyByAt);
});

test('datas do Moodle não entregam UA/vídeo manual e texto da atividade não é guardado nem exibido', () => {
  const secret = 'CONTEUDO_INTERNO_NAO_EXIBIR';
  const raw = normalizeRows([row({ activity_content: '<p>' + secret + '</p>' }), row({ cm_id: '70', activity_name: 'Videoaula 1' }), row({ cm_id: '71', activity_name: 'Unidade de aprendizagem 1' })], generatedAt, deadlines);
  assert.doesNotMatch(JSON.stringify(raw), new RegExp(secret));
  assert.doesNotMatch(pilotEvidenceReport(raw, 90).join('\n'), new RegExp(secret));
  const current = buildSnapshot(raw, catalog, { rulesApproved: false });
  const manual = current.rows.filter((entry) => entry.requirement.manualControl);
  assert.ok(manual.length > 0); assert.ok(manual.every((entry) => entry.timingSource !== 'MOODLE_READY_BY_BOUND' && !entry.readyByAt));
});
