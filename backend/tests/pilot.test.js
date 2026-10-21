const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { pathToFileURL } = require('node:url');
const { loadConfig } = require('../config');
const { pilotEnvironment, loadPilotEnvironment, pilotErrorMessage, APP_ORIGIN, LOOPBACK } = require('../core/pilot');
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
  assert.throws(() => loadPilotEnvironment(dir, { NODE_ENV: 'production' }), (error) => error.code === 'PILOT_CONFIG');
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

test('proxy local abre o NED com dados Moodle, mantém API direta anônima e bloqueia demo, origem externa e envio', async (t) => {
  const environment = pilotEnvironment(input, root); const config = loadConfig(environment);
  const runtime = await createRuntime(environment); t.after(() => runtime.close());
  const catalog = loadCatalog(path.join(root, 'backend/config/rules.json'));
  const snapshot = buildSnapshot(normalizeRows([fixtureRow()], new Date().toISOString()), catalog, { rulesApproved: false });
  assert.deepEqual(validateSnapshot(snapshot), []); assert.equal(snapshot.isDemo, false); assert.equal(snapshot.publishAllowed, false);
  await runtime.services.store.saveSnapshot(snapshot);
  const server = createApp(runtime).listen(0, LOOPBACK); await once(server, 'listening');
  const { createServer } = await import('vite');
  const { pilotServerOptions } = await import(pathToFileURL(path.join(root, 'scripts/pilot-server.mjs')).href);
  const options = pilotServerOptions(root, config);
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
  const html = await (await fetch(url)).text(); assert.match(html, /PILOTO LOCAL/); assert.ok(!html.includes(input.MOODLE_DB_PASSWORD)); assert.ok(!html.includes(config.auth.proxySharedSecret));
  const external = await fetch(url + '/api/operations/snapshots', { method: 'POST', headers: { cookie, origin: 'https://externo.example.invalid', 'x-csrf-token': session.csrfToken } }); assert.equal(external.status, 403);
  const demo = await fetch(url + '/api/auth/demo-login', { method: 'POST', headers: { cookie, origin: APP_ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify({ profileId: 'ned' }) }); assert.equal(demo.status, 404);
  const send = await fetch(url + '/api/reports/send', { method: 'POST', headers: { cookie, origin: APP_ORIGIN, 'x-csrf-token': session.csrfToken, 'Content-Type': 'application/json' }, body: JSON.stringify({ audience: 'coordinators', snapshotId: snapshot.id, recipientEmails: ['invalido@example.invalid'] }) }); assert.equal(send.status, 409);
});
