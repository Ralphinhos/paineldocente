const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { pathToFileURL } = require('node:url');
const { loadConfig } = require('../config');
const { pilotEnvironment, loadPilotEnvironment, pilotRuntimeOptions, pilotErrorMessage, APP_ORIGIN, LOOPBACK } = require('../core/pilot');
const { pilotScopeReport } = require('../core/pilot-scope');
const { MoodleSource } = require('../data/moodleSource');
const { createRuntime } = require('../runtime');
const { createApp } = require('../app');
const { buildSnapshot, loadCatalog } = require('../core/rules');
const { normalizeRows } = require('../data/moodleSource');
const { validateSnapshot } = require('../scripts/validate-snapshot');

const root = path.resolve(__dirname, '../..');
const input = { MOODLE_DB_SERVER: 'sql.example.invalid', MOODLE_DB_DATABASE: 'moodle', MOODLE_DB_USER: 'consulta', MOODLE_DB_PASSWORD: 'senha-ficticia-#&% !', MOODLE_COURSE_IDS: '10' };

test('piloto obriga amostra, bloqueia configuração de produção e preserva IDs como bigint sem arredondamento', () => {
  for (const ids of ['', '0', '-1', '1 OR 1=1', '1;DROP TABLE x', '9223372036854775808', Array.from({ length: 11 }, (_, i) => i + 1).join(',')]) {
    assert.throws(() => pilotEnvironment({ ...input, MOODLE_COURSE_IDS: ids }, root), (error) => error.code === 'PILOT_CONFIG');
  }
  assert.throws(() => pilotEnvironment({ ...input, NODE_ENV: 'production' }, root), (error) => error.code === 'PILOT_CONFIG');
  assert.throws(() => pilotEnvironment({ ...input, MOODLE_DB_SERVER: 'servidor\\instancia' }, root), (error) => error.code === 'PILOT_CONFIG');
  const config = loadConfig(pilotEnvironment({ ...input, MOODLE_COURSE_IDS: '10,10,9007199254740993' }, root));
  assert.deepEqual(config.moodle.courseIds, ['10', '9007199254740993']);
  assert.deepEqual(loadConfig({}).moodle.courseIds, []);
});

test('arquivo local preserva senha entre aspas e não habilita e-mails, contas demo ou publicação por variáveis extras', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ned-pilot-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  assert.throws(() => loadPilotEnvironment(dir, {}), (error) => error.code === 'PILOT_CONFIG');
  fs.writeFileSync(path.join(dir, '.env.piloto'), Object.entries(input).map(([key, value]) => key + '=' + JSON.stringify(value)).join('\n') + '\nEMAIL_SEND_ENABLED=true\nRULES_APPROVED=true\nAUTH_MODE=demo\nDATA_SOURCE=demo\nAPP_DATABASE_URL=postgres://invalido\n');
  const config = loadConfig(loadPilotEnvironment(dir, { EMAIL_SEND_ENABLED: 'true', DATA_SOURCE: 'demo' }));
  assert.equal(config.moodle.password, input.MOODLE_DB_PASSWORD);
  assert.equal(config.dataSource, 'moodle'); assert.equal(config.snapshotStore, 'memory');
  assert.equal(config.auth.mode, 'proxy'); assert.equal(config.auth.demoEnabled, false);
  assert.equal(config.reports.emailEnabled, false); assert.deepEqual(config.reports.recipients, []);
  assert.equal(config.rules.approved, false); assert.equal(config.appDatabaseUrl, undefined);
  assert.equal(config.moodle.server, input.MOODLE_DB_SERVER);
  assert.equal(pilotRuntimeOptions(loadPilotEnvironment(dir, {})).trustServerCertificate, false);
  assert.throws(() => loadPilotEnvironment(dir, { NODE_ENV: 'production' }), (error) => error.code === 'PILOT_CONFIG');
});

test('aceitar certificado exige opção explícita do piloto e é recusado fora do contexto local', async (t) => {
  assert.throws(() => pilotEnvironment({ ...input, PILOT_TRUST_SERVER_CERTIFICATE: 'talvez' }, root), (error) => error.code === 'PILOT_CONFIG');
  const environment = pilotEnvironment({ ...input, PILOT_TRUST_SERVER_CERTIFICATE: 'true' }, root);
  const options = pilotRuntimeOptions(environment);
  assert.equal(options.trustServerCertificate, true);
  const regular = await createRuntime(environment); t.after(() => regular.close());
  assert.equal(regular.services.snapshotService.source.trustServerCertificate, false);
  const pilot = await createRuntime(environment, options); t.after(() => pilot.close());
  assert.equal(pilot.services.snapshotService.source.trustServerCertificate, true);
  for (const changes of [
    { APP_ORIGIN: 'http://0.0.0.0:8080' },
    { SNAPSHOT_STORE: 'postgres', APP_DATABASE_URL: 'postgres://fake@example.invalid/app' },
    { NODE_ENV: 'production', SNAPSHOT_STORE: 'postgres', APP_DATABASE_URL: 'postgres://fake@example.invalid/app', COOKIE_SECURE: 'true' },
    { EMAIL_SEND_ENABLED: 'true', SMTP_HOST: 'smtp.example.invalid', SMTP_FROM: 'ned@example.invalid' },
  ]) await assert.rejects(createRuntime({ ...environment, ...changes }, options), (error) => error.code === 'PILOT_CONFIG');
});

test('a opção do piloto altera só a confiança no certificado e mantém criptografia no driver SQL', async (t) => {
  const mssql = require('mssql'); const captured = [];
  t.mock.method(mssql, 'ConnectionPool', function (options) {
    captured.push(options);
    return { async connect() { return { async close() {} }; } };
  });
  const config = loadConfig(pilotEnvironment(input, root));
  const strict = new MoodleSource(config.moodle); await strict.connect(); await strict.close();
  const local = new MoodleSource({ ...config.moodle, caFile: 'arquivo-inexistente.pem' }, { trustServerCertificate: true }); await local.connect(); await local.close();
  assert.equal(captured[0].options.encrypt, true); assert.equal(captured[0].options.trustServerCertificate, false);
  assert.equal(captured[1].options.encrypt, true); assert.equal(captured[1].options.trustServerCertificate, true);
});

test('diagnóstico substitui erro do driver e não imprime senha nem string de conexão', () => {
  for (const code of ['ELOGIN', 'ESOCKET', 'ETIMEOUT', 'EREQUEST', 'DESCONHECIDO']) {
    const message = pilotErrorMessage({ code, message: 'Connection failed; password=' + input.MOODLE_DB_PASSWORD });
    assert.ok(!message.includes(input.MOODLE_DB_PASSWORD)); assert.ok(!message.includes('password='));
  }
  assert.match(pilotErrorMessage({ code: 'ESOCKET', message: 'self signed certificate' }), /Certificado/);
  assert.match(pilotErrorMessage({ code: 'EREQUEST', number: 207 }), /207/);
});

function fixtureRow(overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  return { course_id: '10', course_name: 'Disciplina de teste', course_shortname: 'TESTE-2026-2-40H', startdate: now - 7 * 86400, enddate: now + 30 * 86400,
    originalcourseid: null, course_created_at: now - 30 * 86400, category_name: 'Tecnologia', modality_field_value: 'Modular', category_field_value: null, workload_value: '40h',
    teacher_id: '20', teacher_name: 'Docente de teste', teacher_email: 'docente@example.invalid', assigned_at: now - 7 * 86400, last_access_at: now - 5 * 86400, environment_last_access_at: now,
    cm_id: '30', module_name: 'assign', activity_name: 'Desafio', activity_visible: 1, ...overrides };
}
function fakePool(recordset, captures) {
  return { request() { return { input(name, type, value) { captures[name] = value; return this; }, async query(sql) { captures.sql = sql; return { recordset }; } }; }, async close() {} };
}

test('coleta parametriza IDs, mantém acesso global e interrompe retorno fora da amostra ou incompleto', async () => {
  const config = loadConfig(pilotEnvironment(input, root)); const source = new MoodleSource(config.moodle); const captures = {};
  source.pool = fakePool([fixtureRow()], captures);
  const raw = await source.fetch();
  assert.equal(captures.courseIds, '["10"]'); assert.match(captures.sql, /@courseIds/);
  assert.equal(raw.source, 'moodle'); assert.equal(raw.courses.length, 1);
  assert.ok(raw.courses[0].teachers[0].environmentAccessKnown);
  source.pool = fakePool([fixtureRow({ course_id: '11' })], {});
  await assert.rejects(source.fetch(), (error) => error.code === 'COURSE_SCOPE_VIOLATION');
  source.pool = fakePool([], {});
  await assert.rejects(source.fetch(), (error) => error.code === 'COURSE_SCOPE_INCOMPLETE');
  source.pool = fakePool([{ id: '10' }], {}); assert.deepEqual(await source.testConnection(), { courses: 1 });
  source.pool = fakePool([], {});
  await assert.rejects(source.testConnection(), (error) => error.code === 'PILOT_COURSES_MISSING');
  await source.close();
});

function scopeRow(overrides = {}) {
  return { course_id: '10', course_exists: true, category_id: '420', category_exists: true, root_exists: true,
    category_in_scope: true, course_visible: 1, context_count: 1, teacher_role_exists: true, teacher_count: 1,
    roles_json: '[{"id":"3","shortname":"editingteacher","users":1}]', ...overrides };
}

test('diagnóstico parametriza apenas a amostra e recusa consulta sem escopo ou acima do limite', async () => {
  const config = loadConfig(pilotEnvironment({ ...input, MOODLE_COURSE_IDS: '10,9007199254740993' }, root));
  const source = new MoodleSource(config.moodle); const captures = {};
  source.pool = fakePool([scopeRow()], captures);
  const diagnosis = await source.diagnoseCourseScope();
  assert.equal(captures.courseIds, '["10","9007199254740993"]');
  assert.equal(captures.categoryRoot, 109); assert.equal(captures.teacherRoleId, 3);
  assert.match(captures.sql, /OPENJSON\(@courseIds\)/); assert.match(captures.sql, /u\.deleted = 0/);
  assert.equal(diagnosis.rows[0].course_id, '10');
  for (const courseIds of [[], Array.from({ length: 11 }, (_, i) => String(i + 1))]) {
    const invalid = new MoodleSource({ ...config.moodle, courseIds });
    await assert.rejects(invalid.diagnoseCourseScope(), (error) => error.code === 'PILOT_CONFIG');
    assert.equal(invalid.pool, null);
  }
  await source.close();
});

test('diagnóstico distingue filtros simultâneos e lista papéis sem expor pessoas ou aceitar controles de terminal', () => {
  const report = pilotScopeReport({ categoryRoot: 109, teacherRoleId: 3, rows: [scopeRow({
    category_in_scope: false, course_visible: 0, teacher_count: 0,
    teacher_name: 'NOME QUE NAO DEVE SAIR', teacher_email: 'privado@example.invalid',
    roles_json: JSON.stringify([{ id: '7', shortname: 'professor\u001b[31m\ncustomizado', users: 2 }]),
  })] });
  const output = report.lines.join('\n');
  assert.equal(report.ok, false); assert.match(output, /Categoria 420 fora da raiz 109/);
  assert.match(output, /Disciplina oculta/); assert.match(output, /Nenhum usuário não excluído com papel 3/);
  assert.match(output, /7 \(professor/); assert.ok(!output.includes('\u001b'));
  assert.ok(!output.includes('NOME QUE')); assert.ok(!output.includes('privado@example.invalid'));
});

test('diagnóstico permite subcategorias válidas e não confunde filtro aprovado com entrega validada', () => {
  const report = pilotScopeReport({ categoryRoot: 109, teacherRoleId: 3, rows: [scopeRow(), scopeRow({ course_id: '11' })] });
  assert.equal(report.ok, true); assert.match(report.lines.join('\n'), /validar também atividades, logs e prazos/);
  assert.doesNotMatch(report.lines.join('\n'), /BLOQUEADA/);
  // A coleta filtra pela atribuição; não exige uma linha correspondente em mdl_role.
  assert.equal(pilotScopeReport({ categoryRoot: 109, teacherRoleId: 3, rows: [scopeRow({ teacher_role_exists: false })] }).ok, true);
  assert.equal(pilotScopeReport({ categoryRoot: 109, teacherRoleId: 3, rows: [] }).ok, false);
});

test('diagnóstico diferencia ID ausente, raiz inexistente, contexto ausente e papel não encontrado', () => {
  const describe = (row) => pilotScopeReport({ categoryRoot: 109, teacherRoleId: 3, rows: [row] }).lines.join('\n');
  const missing = describe(scopeRow({ course_exists: false }));
  assert.match(missing, /ID não encontrado/); assert.doesNotMatch(missing, /Motivo: Disciplina oculta/);
  const rootMissing = describe(scopeRow({ root_exists: false, category_in_scope: false }));
  assert.match(rootMissing, /Categoria raiz 109 não existe/); assert.doesNotMatch(rootMissing, /fora da raiz/);
  const categoryMissing = describe(scopeRow({ category_exists: false, category_in_scope: false }));
  assert.match(categoryMissing, /categoria da disciplina não foi encontrada/);
  const contextMissing = describe(scopeRow({ context_count: 0, teacher_count: 0, roles_json: '[]' }));
  assert.match(contextMissing, /Sem contexto de disciplina/); assert.doesNotMatch(contextMissing, /Motivo: Nenhum usuário/);
  const roleMissing = describe(scopeRow({ teacher_role_exists: false, teacher_count: 0 }));
  assert.match(roleMissing, /Papel docente configurado \(3\) não existe/);
});

test('proxy local abre o NED com dados Moodle, mantém API direta anônima e bloqueia demo, origem externa e envio', async (t) => {
  const environment = pilotEnvironment({ ...input, PILOT_TRUST_SERVER_CERTIFICATE: 'true' }, root); const config = loadConfig(environment);
  const sqlOptions = pilotRuntimeOptions(environment);
  const runtime = await createRuntime(environment, sqlOptions); t.after(() => runtime.close());
  const catalog = loadCatalog(path.join(root, 'backend/config/rules.json'));
  const snapshot = buildSnapshot(normalizeRows([fixtureRow()], new Date().toISOString()), catalog, { rulesApproved: false });
  assert.deepEqual(validateSnapshot(snapshot), []); assert.equal(snapshot.isDemo, false); assert.equal(snapshot.publishAllowed, false);
  await runtime.services.store.saveSnapshot(snapshot);
  const server = createApp(runtime).listen(0, LOOPBACK); await once(server, 'listening');
  const { createServer } = await import('vite');
  const { pilotServerOptions } = await import(pathToFileURL(path.join(root, 'scripts/pilot-server.mjs')).href);
  const options = pilotServerOptions(root, config, sqlOptions);
  assert.equal(options.server.host, LOOPBACK); assert.equal(options.server.strictPort, true);
  options.server.port = 0; options.server.hmr = false;
  options.optimizeDeps = { noDiscovery: true, include: [] };
  options.logLevel = 'silent';
  options.server.proxy['/api'].target = 'http://127.0.0.1:' + server.address().port;
  const vite = await createServer(options);
  t.after(async () => { await vite.close(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  await vite.listen(); const url = 'http://127.0.0.1:' + vite.httpServer.address().port;
  const direct = await fetch(options.server.proxy['/api'].target + '/api/monitoring'); assert.equal(direct.status, 401);
  const response = await fetch(url + '/api/auth/session', { headers: { 'x-panel-auth-secret': 'forjado', 'x-auth-request-email': 'outro@example.invalid' } });
  const session = await response.json();
  assert.equal(session.authenticated, true); assert.equal(session.user.role, 'ned_admin'); assert.equal(session.user.email, 'piloto.local@example.invalid'); assert.equal(session.demoEnabled, false);
  const cookie = response.headers.get('set-cookie').split(';')[0];
  const monitoring = await (await fetch(url + '/api/monitoring', { headers: { cookie } })).json();
  assert.equal(monitoring.meta.source, 'moodle'); assert.equal(monitoring.meta.isDemo, false);
  const html = await (await fetch(url)).text(); assert.match(html, /PILOTO LOCAL/); assert.match(html, /identidade do servidor SQL não verificada/); assert.ok(!html.includes(input.MOODLE_DB_PASSWORD)); assert.ok(!html.includes(config.auth.proxySharedSecret));
  const external = await fetch(url + '/api/operations/snapshots', { method: 'POST', headers: { cookie, origin: 'https://externo.example.invalid', 'x-csrf-token': session.csrfToken } }); assert.equal(external.status, 403);
  const demo = await fetch(url + '/api/auth/demo-login', { method: 'POST', headers: { cookie, origin: APP_ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify({ profileId: 'ned' }) }); assert.equal(demo.status, 404);
  const send = await fetch(url + '/api/reports/send', { method: 'POST', headers: { cookie, origin: APP_ORIGIN, 'x-csrf-token': session.csrfToken, 'Content-Type': 'application/json' }, body: JSON.stringify({ audience: 'coordinators', snapshotId: snapshot.id, recipientEmails: ['invalido@example.invalid'] }) }); assert.equal(send.status, 409);
});
