const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { normalizeRows } = require('../data/moodleSource');
const { activityFacts, pilotEvidenceReport } = require('../core/moodle-evidence');
const { buildSnapshot, loadCatalog } = require('../core/rules');
const { validateSnapshot } = require('../scripts/validate-snapshot');

const generatedAt = '2026-09-03T12:00:00.000Z';
const catalog = loadCatalog(path.join(__dirname, '../config/rules.json'));
const deadlines = { version: 'test', periods: { '2026/2': { MODULAR: { defaults: { desafio: '2026-08-01T12:00:00.000Z' } } } } };
const unix = (value) => Date.parse(value) / 1000;
function row(overrides = {}) {
  return { course_id: '10', course_name: 'Curso privado', course_shortname: 'PRIVADO-2026-2-40H', startdate: unix('2026-07-01T12:00:00Z'), enddate: unix('2026-12-01T12:00:00Z'),
    originalcourseid: null, course_created_at: unix('2026-07-01T12:00:00Z'), category_name: 'Tecnologia', modality_field_value: 'Modular', workload_value: '40h',
    teacher_id: '20', teacher_name: 'Nome privado', teacher_email: 'privado@example.invalid', assigned_at: unix('2026-07-01T12:00:00Z'), environment_last_access_at: unix('2026-09-01T12:00:00Z'),
    cm_id: '30', module_name: 'assign', activity_name: 'Desafio', activity_visible: 1,
    cm_created_at: unix('2026-07-02T12:00:00Z'), activity_modified_at: unix('2026-08-30T12:00:00Z'), activity_description_present: 1,
    creation_log_at: unix('2026-07-02T12:00:00Z'), first_update_log_at: unix('2026-07-10T12:00:00Z'), last_update_log_at: unix('2026-08-30T12:00:00Z'),
    module_updated_at: unix('2026-07-10T12:00:00Z'), completion_updated_at: unix('2026-07-11T12:00:00Z'), module_viewed_at: unix('2026-07-12T12:00:00Z'), ...overrides };
}

test('datas técnicas entram nas evidências sem virar entrega ou acesso do docente', () => {
  const raw = normalizeRows([row()], generatedAt, deadlines); const course = raw.courses[0]; const activity = course.activities[0];
  assert.equal(course.moodleActivityFacts[0].modifiedAt, '2026-08-30T12:00:00.000Z');
  assert.equal(activity.configuredAt, null); assert.equal(activity.configurationTimeSource, null);
  assert.ok(activity.events.some((event) => event.name === '\\painel\\metadata\\activity_modified'));
  assert.ok(course.teachers[0].accessEvents.every((event) => !event.name.startsWith('\\painel\\metadata\\')));
  const snapshot = buildSnapshot(raw, catalog, { rulesApproved: false });
  const result = snapshot.rows.find((item) => item.requirement.id === 'desafio');
  assert.equal(result.structureStatus, 'NOT_VERIFIABLE'); assert.equal(result.reasonCode, 'CONFIGURATION_DATE_UNKNOWN');
  const technical = result.evidence.filter((item) => item.type.startsWith('MOODLE_'));
  assert.equal(technical.length, 3); assert.ok(technical.every((item) => item.supports === 'CONTEXT_ONLY'));
  assert.match(technical[0].note, /Módulo 30/); assert.deepEqual(validateSnapshot(snapshot), []);
  technical[0].supports = 'DELIVERY_DATE';
  assert.ok(validateSnapshot(snapshot).some((error) => error.startsWith('TECHNICAL_DATE_MISCLASSIFIED:')));
});

test('metadados repetidos não duplicam evidências quando a disciplina tem dois docentes', () => {
  const source = normalizeRows([row(), row({ teacher_id: '21', teacher_name: 'Outro docente' })], generatedAt, deadlines);
  const course = source.courses[0];
  assert.equal(course.moodleActivityFacts.length, 2);
  assert.equal(course.activities[0].events.filter((event) => event.name.startsWith('\\painel\\metadata\\')).length, 3);
});

test('datas técnicas futuras, nulas e inválidas são ignoradas; zero não vira ausência em contagens', () => {
  const facts = activityFacts(row({ cm_created_at: null, activity_modified_at: unix('2027-01-01T12:00:00Z'), creation_log_at: -1, first_update_log_at: Infinity, last_update_log_at: 'inválido', question_slot_count: 0, discussion_count: '2' }), generatedAt);
  assert.equal(facts.addedAt, null); assert.equal(facts.modifiedAt, null); assert.equal(facts.creationLogAt, null);
  assert.equal(facts.firstUpdateLogAt, null); assert.equal(facts.lastUpdateLogAt, null);
  assert.equal(facts.questionSlots, 0); assert.equal(facts.discussions, 2);
});

test('relatório da amostra diferencia ausência de log, metadados e entrega sem imprimir nomes ou e-mails', () => {
  const raw = normalizeRows([row({ module_name: 'quiz', activity_name: 'Avaliação final', question_slot_count: 4, creation_log_at: null }),
    row({ cm_id: '31', module_name: 'forum', activity_name: 'Fórum avaliativo', discussion_count: 0 }),
    row({ cm_id: '32', module_name: 'label', activity_name: 'Videoaula 1' })], generatedAt, deadlines);
  const report = pilotEvidenceReport(raw, 90).join('\n');
  assert.match(report, /últimos 90 dias/); assert.match(report, /criação sem registro/);
  assert.match(report, /Posições de questões no questionário: 4/); assert.match(report, /Tópicos no fórum: 0/);
  assert.match(report, /não comprovam entrega/); assert.doesNotMatch(report, /Nome privado|privado@example.invalid|Curso privado|Videoaula/);
});

test('comando de evidências consulta a amostra, fecha conexão e termina sem iniciar painel', async (t) => {
  const root = path.resolve(__dirname, '../..'); const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'ned-evidence-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  fs.mkdirSync(path.join(temporary, 'scripts'));
  fs.copyFileSync(path.join(root, 'scripts/piloto.mjs'), path.join(temporary, 'scripts/piloto.mjs'));
  fs.symlinkSync(path.join(root, 'backend'), path.join(temporary, 'backend'), 'junction');
  fs.writeFileSync(path.join(temporary, '.env.piloto'), 'MOODLE_DB_SERVER=sql.example.invalid\nMOODLE_DB_DATABASE=moodle\nMOODLE_DB_USER=consulta\nMOODLE_DB_PASSWORD="SENHA_PRIVADA_TESTE"\nMOODLE_COURSE_IDS=10\nPILOT_INCLUDE_HIDDEN_COURSES=true\n');
  const preload = path.join(temporary, 'sql-mock.cjs');
  fs.writeFileSync(preload, `const sql = require(${JSON.stringify(require.resolve('mssql'))});
    sql.ConnectionPool = class {
      async connect() { return this; }
      request() { const values = {}; return {
        input(name, type, value) { values[name] = value; return this; },
        async query(query) {
          if (values.courseIds !== '["10"]') throw new Error('Consulta fora da amostra');
          if (query.includes('activity_instances AS')) return { recordset: [${JSON.stringify(row())}] };
          if (query.includes('WHERE id IN')) return { recordset: [{id:'10'}] };
          throw new Error('Consulta inesperada');
        }
      }; }
      async close() { process.stderr.write('sql-pool-closed\\n'); }
    };`);
  const result = await promisify(execFile)(process.execPath, ['--require', preload, path.join(temporary, 'scripts/piloto.mjs'), '--evidence-only'], { cwd: temporary, timeout: 15000, env: { ...process.env, NODE_ENV: 'test' } });
  assert.match(result.stdout, /EVIDÊNCIAS MOODLE/); assert.match(result.stdout, /Disciplina 10/);
  assert.match(result.stdout, /última alteração da instância/); assert.match(result.stderr, /sql-pool-closed/);
  assert.doesNotMatch(result.stdout, /Abra http|Nome privado|privado@example.invalid|SENHA_PRIVADA_TESTE/);
});
