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
