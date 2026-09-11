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
test('NED recebe um pacote de UAs e videoaulas conforme a carga horária', async () => {
  const { runtime, agent } = await login('ned');
  const response = await agent.get('/api/operations/manual-deliveries?pageSize=50').expect(200);
  assert.ok(response.body.items.length > 0);
  assert.ok(response.body.items.some((item) => item.requirement.id === 'unidades_aprendizagem:1'));
  assert.ok(!response.body.items.some((item) => item.requirement.id === 'unidades_aprendizagem:2'));
  assert.ok(response.body.items.some((item) => item.requirement.id === 'videos:1'));
  assert.equal(response.body.items.filter((item) => item.course.id === '1101' && item.requirement.baseId === 'videos').length, 4);
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
test('NED abre nova versão com prazo próprio e preserva histórico', async () => {
  const { runtime, agent, csrf } = await login('ned');
  const current = await agent.get('/api/operations/manual-deliveries?pageSize=50').expect(200);
  const item = current.body.items.find((candidate) => candidate.course.id === '1101' && candidate.requirement.id === 'videos:1');
  const created = await agent.post('/api/operations/manual-deliveries/revisions').set('Origin', env.APP_ORIGIN).set('x-csrf-token', csrf).send({ snapshotId: current.body.meta.snapshotId, courseId: item.course.id, teacherId: item.teacher.id, requirementId: item.requirement.baseId, itemNumber: item.requirement.itemNumber, scope: 'ITEM', reason: 'Atualização do conteúdo da disciplina.', deadlineDate: '2026-09-20' }).expect(201);
  assert.equal(created.body.created, 1);
  const refreshed = await agent.get('/api/operations/manual-deliveries?pageSize=50').expect(200);
  const versioned = refreshed.body.items.find((candidate) => candidate.id === item.id);
  assert.equal(versioned.version, 2); assert.equal(versioned.disposition, 'PENDING'); assert.equal(versioned.replacementReason, 'Atualização do conteúdo da disciplina.'); assert.equal(versioned.history.length, 2);
  const latest = await runtime.services.store.latestSnapshot();
  const row = latest.rows.find((candidate) => candidate.course.id === '1101' && candidate.requirement.id === 'videos:1');
  assert.equal(row.manualVersion, 2); assert.equal(row.deadlineSource, 'MANUAL_REVISION'); assert.equal(row.structureStatus, 'PENDING');
  await agent.post('/api/operations/manual-deliveries').set('Origin', env.APP_ORIGIN).set('x-csrf-token', csrf).send({ snapshotId: refreshed.body.meta.snapshotId, deliveries: [{ courseId: versioned.course.id, teacherId: versioned.teacher.id, requirementId: versioned.requirement.baseId, itemNumber: versioned.requirement.itemNumber, revision: 2, disposition: 'DELIVERED', evidenceDate: '2026-09-01', publishedDate: null, justification: null }] }).expect(201);
  const savedVersions = (await runtime.services.store.listManualDeliveries()).filter((record) => record.courseId === '1101' && record.requirementId === 'videos' && record.itemNumber === 1);
  assert.deepEqual(savedVersions.map((record) => record.revision).sort(), [1, 2]); assert.equal(savedVersions.find((record) => record.revision === 2).disposition, 'DELIVERED');
  assert.ok(runtime.services.store.auditEvents.some((event) => event.action === 'MATERIAL_REVISION_CREATED'));
  await runtime.close();
});
test('regravação em lote abre nova versão para todas as videoaulas', async () => {
  const { runtime, agent, csrf } = await login('ned');
  const current = await agent.get('/api/operations/manual-deliveries?pageSize=50').expect(200);
  const item = current.body.items.find((candidate) => candidate.course.id === '1101' && candidate.requirement.id === 'videos:1');
  const created = await agent.post('/api/operations/manual-deliveries/revisions').set('Origin', env.APP_ORIGIN).set('x-csrf-token', csrf).send({ snapshotId: current.body.meta.snapshotId, courseId: item.course.id, teacherId: item.teacher.id, requirementId: 'videos', itemNumber: 1, scope: 'ALL_VIDEOS', reason: 'Regravação integral da disciplina.', deadlineDate: '2026-09-20' }).expect(201);
  assert.equal(created.body.created, 4);
  const latest = await runtime.services.store.latestSnapshot();
  const videos = latest.rows.filter((candidate) => candidate.course.id === '1101' && candidate.teacher.id === item.teacher.id && candidate.requirement.baseId === 'videos');
  assert.equal(videos.length, 4); assert.ok(videos.every((row) => row.manualVersion === 2 && row.structureStatus === 'PENDING'));
  await runtime.close();
});
test('estrutura herdada pode ser reaberta quando houver troca de material', async () => {
  const { runtime, agent, csrf } = await login('ned');
  const current = await agent.get('/api/operations/manual-deliveries?pageSize=50').expect(200);
  const item = current.body.items.find((candidate) => candidate.course.id === '1102' && candidate.requirement.id === 'unidades_aprendizagem:1');
  assert.equal(item.status, 'INHERITED_READY'); assert.equal(item.editable, false);
  await agent.post('/api/operations/manual-deliveries/revisions').set('Origin', env.APP_ORIGIN).set('x-csrf-token', csrf).send({ snapshotId: current.body.meta.snapshotId, courseId: item.course.id, teacherId: item.teacher.id, requirementId: item.requirement.baseId, itemNumber: 1, scope: 'ITEM', reason: 'Troca do pacote de UAs.', deadlineDate: '2026-09-20' }).expect(201);
  const refreshed = await agent.get('/api/operations/manual-deliveries?pageSize=50').expect(200);
  const versioned = refreshed.body.items.find((candidate) => candidate.id === item.id);
  assert.equal(versioned.version, 2); assert.equal(versioned.status, 'PENDING'); assert.equal(versioned.editable, true); assert.equal(versioned.history.at(-1).disposition, 'INHERITED_READY');
  await runtime.close();
});
test('controle manual não duplica itens atribuídos nem permite registrar para outro docente', async () => {
  const { runtime, agent, csrf } = await login('ned');
  const current = await agent.get('/api/operations/manual-deliveries?courseId=1104&pageSize=50').expect(200);
  assert.equal(current.body.items.filter((item) => item.requirement.baseId === 'unidades_aprendizagem').length, 1);
  assert.ok(current.body.items.every((item) => item.requirement.responsibility === 'ASSIGNED'));
  const snapshot = await runtime.services.store.latestSnapshot();
  const other = snapshot.rows.find((row) => row.requirement.manualControl && row.requirement.responsibility === 'OTHER_TEACHER');
  await agent.post('/api/operations/manual-deliveries').set('Origin', env.APP_ORIGIN).set('x-csrf-token', csrf).send({ snapshotId: snapshot.id, deliveries: [{ courseId: other.course.id, teacherId: other.teacher.id, requirementId: other.requirement.baseId, itemNumber: other.requirement.itemNumber, disposition: 'PENDING' }] }).expect(409).expect((response) => assert.equal(response.body.error.code, 'DELIVERY_OWNER_MISMATCH'));
  await runtime.close();
});
