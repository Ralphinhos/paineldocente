const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { normalizeRows } = require('../data/moodleSource');
const { buildSnapshot, loadCatalog } = require('../core/rules');
const { pilotEvidenceReport } = require('../core/moodle-evidence');
const { validateSnapshot } = require('../scripts/validate-snapshot');

const at = '2026-10-23T15:00:00.000Z';
const unix = (value) => Date.parse(value) / 1000;
const catalog = loadCatalog(path.join(__dirname, '../config/rules.json'));
const dates = { version: 'test', periods: { '2026/2': { GRADUACAO_EAD: { defaults: { avaliacao_final: '2026-09-21T15:00:00.000Z' } } } } };
function question(overrides = {}) {
  return { slot_id: '100', question_id: '200', status: 'ready', qtype: 'multichoice',
    content_text: '<p>Enunciado privado da questão.</p>', created_at: unix('2026-08-26T15:00:00Z'), modified_at: unix('2026-08-26T15:00:00Z'),
    created_log_at: unix('2026-08-26T15:00:00Z'), created_log_user_id: '20', ...overrides };
}
function row(questions = [question()], overrides = {}) {
  return { course_id: '10', course_name: 'Disciplina de teste', course_shortname: 'TESTE-2026-2-40H',
    startdate: unix('2026-07-01T15:00:00Z'), enddate: unix('2026-12-01T15:00:00Z'), originalcourseid: null,
    course_created_at: unix('2025-11-01T15:00:00Z'), modality_field_value: 'Graduação EaD', workload_value: '40h',
    teacher_id: '20', teacher_name: 'Docente privado', teacher_email: 'docente@example.invalid', assigned_at: unix('2026-07-01T15:00:00Z'),
    environment_last_access_at: unix('2026-10-22T15:00:00Z'), cm_id: '30', module_name: 'quiz', activity_name: 'Avaliação final', activity_visible: 1,
    cm_created_at: unix('2025-12-19T15:00:00Z'), activity_modified_at: unix('2026-07-07T15:00:00Z'),
    question_slot_count: questions.length, quiz_question_details: JSON.stringify(questions),
    quiz_completed_attempts: 28, quiz_first_finished_at: unix('2026-10-02T15:00:00Z'), ...overrides };
}
function snapshot(value, options = {}) { return buildSnapshot(normalizeRows([value], at, dates), catalog, { rulesApproved: false, ...options }); }
function result(value) { return value.rows.find((entry) => entry.requirement.id === 'avaliacao_final'); }

test('criação/importação vinculada à avaliação comprova preparo antes da primeira resposta dos alunos', () => {
  const raw = normalizeRows([row([question(), question({ slot_id: '101', question_id: '201', created_at: unix('2026-08-27T15:00:00Z'), modified_at: unix('2026-08-27T15:00:00Z'), created_log_at: unix('2026-08-27T15:00:00Z') })])], at, dates);
  const current = buildSnapshot(raw, catalog, { rulesApproved: false }); const item = result(current);
  assert.equal(item.structureStatus, 'DELIVERED_ON_TIME'); assert.equal(item.readyByAt, '2026-08-27T15:00:00.000Z');
  assert.equal(item.configuredAt, null); assert.equal(item.daysLate, 0);
  assert.deepEqual(validateSnapshot(current), []);
  assert.ok(item.evidence.some((entry) => entry.type === 'MOODLE_READY_BY_QUIZ_QUESTIONS_PREPARED'));
  const report = pilotEvidenceReport(raw, 90).join('\n');
  assert.match(report, /Questões vinculadas consultadas: 2; preparo estrutural: confirmado/);
  assert.match(report, /Respostas dos alunos não definem a entrega/);
  assert.doesNotMatch(JSON.stringify(raw) + JSON.stringify(current) + report, /Enunciado privado|docente@example.invalid.*Enunciado/);
});

test('questão antiga de banco compartilhado usa a inclusão nesta avaliação, sem antecipação presumida', () => {
  const shared = question({ created_at: unix('2025-01-01T15:00:00Z'), modified_at: unix('2025-01-01T15:00:00Z'), created_log_at: null, created_log_user_id: null });
  assert.equal(result(snapshot(row([shared]))).structureStatus, 'NOT_VERIFIABLE');
  const onTime = result(snapshot(row([{ ...shared, added_log_at: unix('2026-09-21T15:00:00Z') }])));
  assert.equal(onTime.structureStatus, 'DELIVERED_ON_TIME'); assert.equal(onTime.readyByAt, '2026-09-21T15:00:00.000Z');
  const afterDeadline = result(snapshot(row([{ ...shared, added_log_at: unix('2026-09-23T15:00:00Z') }])));
  assert.equal(afterDeadline.structureStatus, 'NOT_VERIFIABLE'); assert.equal(afterDeadline.readyByAt, '2026-09-23T15:00:00.000Z');
  assert.equal(afterDeadline.overdue, false); assert.equal(afterDeadline.daysLate, null);
});

test('conclusão, autoria atual ou questão movida de outro banco não substituem o vínculo histórico', () => {
  const value = row([question({ created_log_at: null, created_log_user_id: null })], {
    completion_updated_at: unix('2026-08-26T15:00:00Z'), module_viewed_at: unix('2026-08-26T15:00:00Z'),
  });
  assert.equal(result(snapshot(value)).structureStatus, 'NOT_VERIFIABLE');
  const otherAuthor = row([question({ created_log_user_id: '999' })]);
  assert.equal(result(snapshot(otherAuthor)).structureStatus, 'NOT_VERIFIABLE');
  assert.equal(result(snapshot(row([question({ added_log_at: unix('2026-08-27T15:00:00Z'), created_log_user_id: '999' })]))).structureStatus, 'DELIVERED_ON_TIME');
});

test('posição sem questão resolvida, rascunho, texto vazio ou sorteio não confirmado permanece a validar', () => {
  for (const changes of [{ question_id: null }, { status: 'draft' }, { status: 'hidden' }, { qtype: 'random' }, { qtype: 'missingtype' }, { qtype: null }, { content_text: '<p>&nbsp;</p>' }]) {
    const item = result(snapshot(row([question(changes)])));
    assert.equal(item.structureStatus, 'NOT_VERIFIABLE'); assert.equal(item.reasonCode, 'PREPARATION_NOT_CONFIRMED');
    assert.equal(item.overdue, false);
  }
  for (const value of [row([], { question_slot_count: 10 }), row([question(), question()]), row([question({ qtype: 'description' })]), row([], { quiz_question_details: 'inválido' })]) {
    assert.equal(result(snapshot(value)).structureStatus, 'NOT_VERIFIABLE');
  }
});

test('datas inválidas, futuras ou posteriores ao prazo não geram entrega nem atraso presumido', () => {
  for (const changes of [{ created_at: 0 }, { modified_at: null }, { modified_at: unix('2026-08-01T15:00:00Z') },
    { created_log_at: unix('2027-01-01T15:00:00Z') }, { version_log_at: unix('2027-01-01T15:00:00Z') },
    { modified_at: unix('2026-09-23T15:00:00Z') }, { version_log_at: unix('2026-09-23T15:00:00Z') }]) {
    const item = result(snapshot(row([question(changes)])));
    assert.equal(item.structureStatus, 'NOT_VERIFIABLE'); assert.equal(item.overdue, false);
  }
});

test('avaliação herdada já preparada antes da responsabilidade não depende da entrega de UA/vídeos', () => {
  const value = row([question()], { originalcourseid: '9', course_created_at: unix('2026-07-01T15:00:00Z'), assigned_at: unix('2026-09-01T15:00:00Z') });
  const current = snapshot(value); const item = result(current);
  assert.equal(item.structureStatus, 'INHERITED_READY'); assert.equal(item.provenance, 'INHERITED_VERIFIED'); assert.equal(item.daysLate, null);
  assert.ok(current.rows.some((entry) => entry.requirement.manualControl && entry.structureStatus !== 'INHERITED_READY'));
  assert.deepEqual(validateSnapshot(current), []);
  const noOrigin = result(snapshot({ ...value, originalcourseid: null }));
  assert.equal(noOrigin.structureStatus, 'DELIVERED_ON_TIME'); assert.notEqual(noOrigin.provenance, 'INHERITED_VERIFIED');
  const laterPreparation = result(snapshot({ ...value, quiz_question_details: JSON.stringify([question({ modified_at: unix('2026-09-23T15:00:00Z') })]) }));
  assert.equal(laterPreparation.structureStatus, 'NOT_VERIFIABLE'); assert.equal(laterPreparation.provenance, 'RESTORED_NOT_EXEMPT');
  const preserved = snapshot({ ...value, quiz_question_details: JSON.stringify([question({ modified_at: unix('2026-09-23T15:00:00Z') })]) }, { previousSnapshot: current });
  assert.equal(result(preserved).structureStatus, 'INHERITED_READY'); assert.equal(result(preserved).readyByAt, item.readyByAt);
  assert.deepEqual(validateSnapshot(preserved), []);
  const replacedQuiz = snapshot({ ...value, cm_id: '31', quiz_question_details: JSON.stringify([question({ modified_at: unix('2026-09-23T15:00:00Z') })]) }, { previousSnapshot: current });
  assert.equal(result(replacedQuiz).structureStatus, 'NOT_VERIFIABLE');
  const unbacked = structuredClone(current); result(unbacked).evidence = [];
  assert.ok(validateSnapshot(unbacked).some((error) => error.startsWith('MOODLE_QUIZ_REUSE_INVALID:')));
});

test('primeira coleta não presume reaproveitamento só por questões antigas ou origem de curso', () => {
  const value = row([question({ created_log_at: null, created_log_user_id: null })], {
    originalcourseid: '9', course_created_at: unix('2026-07-01T15:00:00Z'), assigned_at: unix('2026-09-01T15:00:00Z'),
  });
  const item = result(snapshot(value));
  assert.equal(item.structureStatus, 'NOT_VERIFIABLE'); assert.equal(item.provenance, 'RESTORED_NOT_EXEMPT');
  const withoutDeadline = buildSnapshot(normalizeRows([row([question()], { ...value, quiz_question_details: JSON.stringify([question()]) })], at), catalog, { rulesApproved: false });
  assert.deepEqual(validateSnapshot(withoutDeadline), []);
});

test('comprovação anterior pelas questões é preservada; a antiga prova por tentativa de aluno não é reutilizada', () => {
  const previous = snapshot(row());
  const changed = row([question({ modified_at: unix('2026-09-23T15:00:00Z') })]);
  assert.equal(result(snapshot(changed, { previousSnapshot: previous })).structureStatus, 'DELIVERED_ON_TIME');
  const obsolete = structuredClone(previous); const oldItem = result(obsolete);
  oldItem.evidence = [{ type: 'MOODLE_READY_BY_QUIZ_FINISHED_ATTEMPT', occurredAt: oldItem.readyByAt, supports: 'READY_BY_BOUND' }];
  assert.equal(result(snapshot(changed, { previousSnapshot: obsolete })).structureStatus, 'NOT_VERIFIABLE');
  assert.ok(validateSnapshot(obsolete).some((error) => error.startsWith('MOODLE_BOUND_INVALID:')));
});
