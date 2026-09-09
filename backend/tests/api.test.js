const test = require('node:test'); const assert = require('node:assert/strict'); const request = require('supertest'); const { createApp } = require('../app'); const { createRuntime } = require('../runtime');
const env = { NODE_ENV: 'test', APP_ORIGIN: 'http://localhost:8080', AUTH_MODE: 'demo', DEMO_AUTH_ENABLED: 'true', DATA_SOURCE: 'demo', SNAPSHOT_STORE: 'memory', RULES_APPROVED: 'false', EMAIL_SEND_ENABLED: 'false' };
async function login(profileId) { const runtime = await createRuntime(env); const agent = request.agent(createApp(runtime)); const response = await agent.post('/api/auth/demo-login').set('Origin', env.APP_ORIGIN).send({ profileId }).expect(201); return { runtime, agent, csrf: response.body.csrfToken }; }
test('anônimo não recebe dashboard', async () => { const runtime = await createRuntime(env); const app = createApp(runtime); await request(app).get('/api/auth/session').expect(200); await request(app).get('/api/dashboard').expect(401); await runtime.close(); });
test('coordenação recebe somente cursos autorizados', async () => { const { runtime, agent } = await login('coordenacao'); const response = await agent.get('/api/dashboard').expect(200); assert.deepEqual([...new Set(response.body.rows.map((x) => x.course.id))].sort(), ['1101', '1102']); await runtime.close(); });
test('mutação exige origem e CSRF', async () => { const { runtime, agent, csrf } = await login('ned'); await agent.post('/api/operations/snapshots').set('x-csrf-token', csrf).expect(403).expect((r) => assert.equal(r.body.error.code, 'ORIGIN_REJECTED')); await agent.post('/api/operations/snapshots').set('Origin', env.APP_ORIGIN).expect(403).expect((r) => assert.equal(r.body.error.code, 'CSRF_REJECTED')); await runtime.close(); });
test('demo bloqueia e-mail externo', async () => { const { runtime, agent, csrf } = await login('ned'); await agent.post('/api/reports/send').set('Origin', env.APP_ORIGIN).set('x-csrf-token', csrf).send({ audience: 'executive' }).expect(409).expect((r) => assert.equal(r.body.error.code, 'DEMO_SEND_BLOCKED')); await runtime.close(); });
test('gestão não gera coleta', async () => { const { runtime, agent, csrf } = await login('gestao'); await agent.post('/api/operations/snapshots').set('Origin', env.APP_ORIGIN).set('x-csrf-token', csrf).expect(403); await runtime.close(); });
test('coordenação não recebe prévias de outros destinatários', async () => {
  const scopedEnv = { ...env, REPORT_RECIPIENTS_JSON: JSON.stringify([{ audience: 'coordinators', email: 'outra.coordenacao@example.invalid', name: 'Outra Coordenação', courseIds: ['1103'] }]) };
  const runtime = await createRuntime(scopedEnv); const agent = request.agent(createApp(runtime));
  await agent.post('/api/auth/demo-login').set('Origin', env.APP_ORIGIN).send({ profileId: 'coordenacao' }).expect(201);
  const response = await agent.get('/api/reports/preview?audience=coordinators').expect(200);
  assert.equal(response.body.reports.length, 1);
  assert.equal(response.body.reports[0].recipient.email, 'coordenacao.demo@example.invalid');
  assert.ok(!response.body.reports[0].text.includes('DD-SEM-40'));
  await runtime.close();
});
test('proxy rejeita conta institucional sem mapeamento', async () => {
  const secret = 'proxy-test-secret-with-at-least-32-characters';
  const proxyEnv = { ...env, AUTH_MODE: 'proxy', DEMO_AUTH_ENABLED: 'false', AUTH_PROXY_SHARED_SECRET: secret, AUTH_USERS_JSON: JSON.stringify([{ email: 'ned@unifenas.br', name: 'NED', role: 'ned_admin', courseIds: [] }]) };
  const runtime = await createRuntime(proxyEnv);
  await request(createApp(runtime)).get('/api/auth/session').set('x-panel-auth-secret', secret).set('x-auth-request-email', 'sem-acesso@unifenas.br').expect(403).expect((response) => assert.equal(response.body.error.code, 'USER_NOT_AUTHORIZED'));
  await runtime.close();
});
test('NED recebe itens individuais de UA e videoaula', async () => {
  const { runtime, agent } = await login('ned');
  const response = await agent.get('/api/operations/manual-deliveries?pageSize=50').expect(200);
  assert.ok(response.body.items.length > 0);
  assert.ok(response.body.items.some((item) => item.requirement.id === 'unidades_aprendizagem:1'));
  assert.ok(response.body.items.some((item) => item.requirement.id === 'videos:1'));
  await runtime.close();
});
test('coordenação não altera controle manual do NED', async () => {
  const { runtime, agent } = await login('coordenacao');
  await agent.get('/api/operations/manual-deliveries').expect(403);
  await runtime.close();
});
test('não aplicável exige justificativa', async () => {
  const { runtime, agent, csrf } = await login('ned');
  const current = await agent.get('/api/operations/manual-deliveries?pageSize=50').expect(200);
  const item = current.body.items.find((candidate) => candidate.editable);
  await agent.post('/api/operations/manual-deliveries').set('Origin', env.APP_ORIGIN).set('x-csrf-token', csrf).send({ snapshotId: current.body.meta.snapshotId, deliveries: [{ courseId: item.course.id, teacherId: item.teacher.id, requirementId: item.requirement.baseId, itemNumber: item.requirement.itemNumber, disposition: 'NOT_APPLICABLE', evidenceDate: null, publishedDate: null, justification: '' }] }).expect(400).expect((response) => assert.equal(response.body.error.code, 'MANUAL_DELIVERY_INVALID'));
  await runtime.close();
});
test('NED salva data docente, mantém publicação separada e gera fotografia', async () => {
  const { runtime, agent, csrf } = await login('ned');
  const current = await agent.get('/api/operations/manual-deliveries?pageSize=50').expect(200);
  const item = current.body.items.find((candidate) => candidate.course.id === '1101' && candidate.requirement.id === 'videos:1');
  const response = await agent.post('/api/operations/manual-deliveries').set('Origin', env.APP_ORIGIN).set('x-csrf-token', csrf).send({ snapshotId: current.body.meta.snapshotId, deliveries: [{ courseId: item.course.id, teacherId: item.teacher.id, requirementId: item.requirement.baseId, itemNumber: item.requirement.itemNumber, disposition: 'DELIVERED', evidenceDate: '2026-09-01', publishedDate: '2026-09-08', justification: null }] }).expect(201);
  assert.notEqual(response.body.snapshotId, current.body.meta.snapshotId);
  const latest = await runtime.services.store.latestSnapshot();
  const row = latest.rows.find((candidate) => candidate.course.id === '1101' && candidate.requirement.id === 'videos:1');
  assert.equal(row.manualEvidenceDate, '2026-09-01'); assert.equal(row.publishedDate, '2026-09-08'); assert.equal(row.timingSource, 'MANUAL_NED');
  assert.ok(runtime.services.store.auditEvents.some((event) => event.action === 'MANUAL_DELIVERY_UPSERT'));
  await runtime.close();
});
