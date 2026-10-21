const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const request = require('supertest');
const { semesterAnalysis } = require('../core/executive');
const { buildSnapshot, loadCatalog } = require('../core/rules');
const { createDemoSource } = require('../data/demoSource');
const { MemoryStore } = require('../services/store');
const { ExecutiveService } = require('../services/executiveService');
const { MonitoringService } = require('../services/monitoringService');
const { createRuntime } = require('../runtime');
const { createApp } = require('../app');
const { loadConfig } = require('../config');

const at = '2026-10-20T15:00:00.000Z';
const catalog = loadCatalog(path.join(__dirname, '../config/rules.json'));
const raw = createDemoSource(new Date(at));
const template = buildSnapshot(raw, catalog, { manualDeliveries: raw.manualDeliveries }).rows.find((row) => row.requirement.responsibility === 'ASSIGNED');
function row(id, status = 'PENDING', extra = {}) {
  const base = structuredClone(template);
  return { ...base, course: { ...base.course, id: 'course-1', period: '2026/2', endsAt: '2026-10-01T15:00:00Z' },
    teacher: { ...base.teacher, id: 'teacher-1', name: 'Docente Homônimo' },
    requirement: { ...base.requirement, id, baseId: id, label: id, manualControl: false, responsibility: 'ASSIGNED' },
    structureStatus: status, overdue: status === 'PENDING', deadlineAt: '2026-10-10T15:00:00Z',
    configuredAt: status === 'DELIVERED_ON_TIME' ? '2026-10-09T15:00:00Z' : status === 'DELIVERED_LATE' ? '2026-10-12T15:00:00Z' : null,
    manualEvidenceDate: null, timingSource: 'DEMO_TRUSTED', environmentAccess: { status: 'CURRENT', daysSinceAccess: 0, lastAccessAt: at }, ...extra };
}
function snapshot(rows, extra = {}) { return { id: crypto.randomUUID(), generatedAt: at, source: 'moodle', rulesVersion: 'homologada-1', rulesStatus: 'APPROVED', isDemo: false, qualityStatus: 'VALID', publishAllowed: true, qualityIssues: [], deadlineVersionId: null, rows, ...extra }; }
function sample() {
  return snapshot([
    row('pontual', 'DELIVERED_ON_TIME'), row('resolvida', 'DELIVERED_LATE'), row('vencida'),
    row('futura', 'PENDING', { overdue: false, deadlineAt: '2026-12-01T15:00:00Z' }),
    row('antecipada-futura', 'DELIVERED_ON_TIME', { deadlineAt: '2026-12-01T15:00:00Z' }),
    row('dispensa', 'NOT_APPLICABLE'), row('incerta', 'NOT_VERIFIABLE'),
    row('sem-dono', 'PENDING', { requirement: { ...template.requirement, id: 'sem-dono', baseId: 'sem-dono', responsibility: 'UNCONFIRMED' } }),
  ]);
}

test('percentuais usam prazos encerrados verificáveis; estados não se sobrepõem', () => {
  const data = semesterAnalysis(sample(), { period: '2026/2' });
  assert.equal(data.summary.due, 3); assert.equal(data.summary.onTimeDue, 1); assert.equal(data.summary.lateDue, 2);
  assert.equal(data.summary.deliveries.overdue, 1); assert.equal(data.summary.deliveries.deliveredLate, 1);
  assert.equal(data.summary.deliveries.pendingInTime, 1); assert.equal(data.summary.deliveries.validation, 2);
  assert.equal(data.summary.deliveries.notApplicable, 1);
  assert.ok(Math.abs(data.topLate[0].latePercent - 200 / 3) < 1e-9);
  assert.equal(data.topLate[0].due, data.topOnTime[0].due);
});
test('docentes são identificados por ID e acesso global inclui disciplinas encerradas do semestre', () => {
  const a = row('a', 'DELIVERED_ON_TIME'); const b = row('b', 'DELIVERED_ON_TIME', { teacher: { ...a.teacher, id: 'teacher-2' } });
  const data = semesterAnalysis(snapshot([a, b]));
  assert.equal(data.summary.teachers, 2); assert.equal(data.summary.access.total, 2);
  assert.equal(data.topRecent.length, 2); assert.equal(data.topRecent[0].daysSinceAccess, 0);
});
test('acesso ausente ou conflitante nunca vira zero nem entra entre os mais recentes', () => {
  const a = row('a'); const conflict = row('b', 'PENDING', { environmentAccess: { status: 'CURRENT', daysSinceAccess: 1, lastAccessAt: '2026-10-19T15:00:00Z' } });
  const data = semesterAnalysis(snapshot([a, conflict]));
  assert.equal(data.summary.access.validation, 1); assert.equal(data.topRecent.length, 0); assert.equal(data.topAbsent.length, 0);
});
test('limiares aprovados mantêm 7 em dia, 8–14 atenção e 15+ crítico', () => {
  const records = [7, 8, 14, 15].map((days, index) => row('a' + index, 'PENDING', { teacher: { id: String(index), name: 'Docente ' + index }, environmentAccess: { daysSinceAccess: days, status: days <= 7 ? 'CURRENT' : days <= 14 ? 'ATTENTION' : 'CRITICAL', lastAccessAt: '2026-10-01T15:00:00Z' } }));
  const data = semesterAnalysis(snapshot(records));
  assert.equal(data.summary.access.current, 1); assert.equal(data.summary.access.attention, 2); assert.equal(data.summary.access.critical, 1);
  assert.deepEqual(data.topAbsent.map((r) => r.daysSinceAccess), [15, 14, 8]);
});
test('nenhum prazo encerrado mantém percentuais indisponíveis, sem ranking artificial', () => {
  const data = semesterAnalysis(snapshot([row('futura', 'PENDING', { overdue: false, deadlineAt: '2026-12-01T15:00:00Z' })]));
  assert.equal(data.teachers[0].latePercent, null); assert.equal(data.teachers[0].onTimePercent, null);
  assert.equal(data.topLate.length, 0); assert.equal(data.topOnTime.length, 0);
});
test('replicado e antecipado com prazo encerrado contam no prazo; compartilhamento não duplica', () => {
  const owned = row('replicado', 'INHERITED_READY'); const other = { ...owned, teacher: { id: 'outro', name: 'Outro' }, requirement: { ...owned.requirement, responsibility: 'OTHER_TEACHER' } };
  const data = semesterAnalysis(snapshot([owned, other, row('antecipado', 'DELIVERED_ON_TIME')]));
  assert.equal(data.summary.deliveries.total, 2); assert.equal(data.summary.onTimeDue, 2); assert.equal(data.summary.due, 2);
  assert.equal(data.teachers.find((r) => r.teacher.id === 'outro').due, 0);
});
test('bimestres separam entregas e preservam a população dos acessos', () => {
  const data = semesterAnalysis(snapshot([row('avaliacao_bimestral_1'), row('avaliacao_bimestral_2'), row('videos:1')]), { bimester: '2' });
  assert.equal(data.summary.deliveries.total, 1); assert.equal(data.summary.access.total, 1);
  assert.match(data.activities[0].id, /avaliacao_bimestral_2$/);
});
test('panorama por semestre usa coleta disponível própria e detalhamento mantém a referência', async () => {
  const store = new MemoryStore(); const old = sample(); await store.saveSnapshot(old);
  const first = snapshot([row('antigo', 'DELIVERED_ON_TIME', { course: { ...template.course, period: '2026/1' } })], { generatedAt: '2026-06-22T15:00:00Z' });
  await store.saveSnapshot(first); const changed = snapshot([row('nova', 'DELIVERED_ON_TIME')], { generatedAt: '2026-10-20T16:00:00Z' }); await store.saveSnapshot(changed);
  const service = new ExecutiveService({ store, snapshotIntervalMinutes: 1440 });
  assert.deepEqual((await service.getOverview()).filters.periods, ['2026/2', '2026/1']);
  assert.equal((await service.getOverview({ period: '2026/1' })).meta.snapshotId, first.id);
  const pinned = await service.getOverview({ period: '2026/2', snapshotId: old.id }); assert.equal(pinned.summary.deliveries.overdue, 1);
  const details = await new MonitoringService({ store, snapshotIntervalMinutes: 1440 }).getMonitoring({ role: 'executive' }, { period: '2026/2', snapshotId: old.id, accessScope: 'semester', deadlineScope: 'closed', deliveryStatus: 'LATE_ALL' });
  assert.equal(details.meta.snapshotId, old.id); assert.equal(details.deliveries.pagination.total, pinned.summary.lateDue);
  await assert.rejects(service.getOverview({ period: '2099/1' }), (e) => e.code === 'SEMESTER_UNAVAILABLE');
});
test('Top 10, busca e paginação suportam mil docentes sem reduzir o universo dos gráficos', async () => {
  const rows = Array.from({ length: 1000 }, (_, i) => row('a-' + i, i % 2 ? 'DELIVERED_ON_TIME' : 'PENDING', { teacher: { id: String(i), name: 'Docente ' + String(i).padStart(4, '0') }, course: { ...template.course, id: 'course-' + i, period: '2026/2' } }));
  const store = new MemoryStore(); await store.saveSnapshot(snapshot(rows)); const service = new ExecutiveService({ store, snapshotIntervalMinutes: 1440 });
  const first = await service.getOverview(); const last = await service.getOverview({ page: 50 }); const found = await service.getOverview({ query: '0999' });
  assert.equal(first.summary.teachers, 1000); assert.equal(first.teachers.rows.length, 20); assert.equal(last.teachers.pagination.total, 1000);
  assert.equal(first.topLate.length, 10); assert.deepEqual(first.topLate, last.topLate); assert.deepEqual(first.summary, found.summary);
  assert.equal(found.teachers.rows[0].teacher.id, '999');
});
test('evolução seleciona uma referência por semana e não mistura versões de regras', async () => {
  const store = new MemoryStore();
  await store.saveSnapshot(sample());
  await store.saveSnapshot(snapshot([row('a')], { generatedAt: '2026-10-20T16:00:00Z' }));
  await store.saveSnapshot(snapshot([row('a')], { generatedAt: '2026-10-13T15:00:00Z' }));
  await store.saveSnapshot(snapshot([row('a')], { generatedAt: '2026-10-06T15:00:00Z', rulesVersion: 'outra-versao' }));
  const service = new ExecutiveService({ store, snapshotIntervalMinutes: 1440 }); const data = await service.getOverview();
  const history = await service.getHistory({ period: data.meta.period, snapshotId: data.meta.snapshotId });
  assert.equal(history.points.length, 2);
  for (const point of history.points) assert.equal(point.total, point.onTime + point.overdue + point.deliveredLate + point.pending + point.validation);
  assert.equal(history.points.at(-1).snapshotId, data.meta.snapshotId);
});
test('período inclui os dois dias em Brasília e filtra antes de escolher a coleta da semana', async () => {
  const store = new MemoryStore();
  const stamps = ['2026-10-06T02:59:59Z', '2026-10-06T03:00:00Z', '2026-10-14T02:59:59Z', '2026-10-14T03:00:00Z', at];
  const snapshots = stamps.map((generatedAt) => snapshot([row('a')], { generatedAt }));
  for (const item of snapshots) await store.saveSnapshot(item);
  const service = new ExecutiveService({ store, snapshotIntervalMinutes: 1440 });
  const scope = { period: '2026/2', snapshotId: snapshots.at(-1).id };
  const filtered = await service.getHistory({ ...scope, dateFrom: '2026-10-06', dateTo: '2026-10-13' });
  assert.deepEqual(filtered.points.map((point) => point.snapshotId), [snapshots[1].id, snapshots[2].id]);
  assert.deepEqual(filtered.range, { dateFrom: '2026-10-06', dateTo: '2026-10-13' });
  const sameDay = await service.getHistory({ ...scope, dateFrom: '2026-10-13', dateTo: '2026-10-13' });
  assert.deepEqual(sameDay.points.map((point) => point.snapshotId), [snapshots[2].id]);
  const until = await service.getHistory({ ...scope, dateTo: '2026-10-05' });
  assert.deepEqual(until.points.map((point) => point.snapshotId), [snapshots[0].id]);
  const since = await service.getHistory({ ...scope, dateFrom: '2026-10-14' });
  assert.deepEqual(since.points.map((point) => point.snapshotId), [snapshots[3].id, snapshots[4].id]);
  const empty = await service.getHistory({ ...scope, dateFrom: '2026-11-01' });
  assert.deepEqual(empty.points, []);
  const cleared = await service.getHistory(scope);
  assert.deepEqual(cleared.points.map((point) => point.snapshotId), [snapshots[1].id, snapshots[3].id, snapshots[4].id]);
  assert.deepEqual((await service.getHistory({ ...scope, dateFrom: '2026-10-13', dateTo: '2026-10-13' })).points, sameDay.points);
});
test('filtro alcança períodos antigos anteriores às últimas 26 semanas sem buscar coletas futuras da referência', async () => {
  const store = new MemoryStore(); const snapshots = [];
  for (let index = 0; index < 35; index++) {
    const item = snapshot([row('a')], { generatedAt: new Date(Date.parse('2026-01-06T15:00:00Z') + index * 7 * 86400000).toISOString() });
    snapshots.push(item); await store.saveSnapshot(item);
  }
  const service = new ExecutiveService({ store, snapshotIntervalMinutes: 1440 });
  const scope = { period: '2026/2', snapshotId: snapshots.at(-1).id };
  assert.equal((await service.getHistory(scope)).points.length, 26);
  const old = await service.getHistory({ ...scope, dateFrom: '2026-01-01', dateTo: '2026-02-28' });
  assert.deepEqual(old.points.map((point) => point.snapshotId), snapshots.slice(0, 8).map((item) => item.id));
  const pinned = await service.getHistory({ ...scope, snapshotId: snapshots[3].id });
  assert.deepEqual(pinned.points.map((point) => point.snapshotId), snapshots.slice(0, 4).map((item) => item.id));
});
test('coleta incompatível na mesma semana não oculta a última coleta comparável do período', async () => {
  const store = new MemoryStore();
  const comparable = snapshot([row('a')], { generatedAt: '2026-10-13T15:00:00Z' });
  await store.saveSnapshot(comparable);
  await store.saveSnapshot(snapshot([row('a')], { generatedAt: '2026-10-14T15:00:00Z', rulesVersion: 'outra-versao' }));
  const reference = snapshot([row('a')]); await store.saveSnapshot(reference);
  const service = new ExecutiveService({ store, snapshotIntervalMinutes: 1440 });
  const history = await service.getHistory({ period: '2026/2', snapshotId: reference.id });
  assert.deepEqual(history.points.map((point) => point.snapshotId), [comparable.id, reference.id]);
});
test('semestre/modo vazios não são apresentados como docentes regulares', () => {
  const result = semesterAnalysis(sample(), { period: '2099/1' });
  assert.equal(result.summary.teachers, 0); assert.equal(result.summary.due, 0); assert.deepEqual(result.topRecent, []);
});
test('somente os dois perfis são configuráveis; cookies antigos não restauram acesso', async (t) => {
  for (const role of ['coordinator', 'auditor']) assert.throws(() => loadConfig({ AUTH_USERS_JSON: JSON.stringify([{ email: 'antigo@example.invalid', name: 'Antigo', role }]) }), /AUTH_USERS_JSON/);
  const runtime = await createRuntime({ NODE_ENV: 'test', AUTH_MODE: 'demo', DATA_SOURCE: 'demo' }); t.after(() => runtime.close());
  for (const role of ['coordinator', 'auditor']) {
    const token = runtime.auth.issueToken({ id: 'antigo', role, name: 'Antigo', email: 'antigo@example.invalid', courseIds: [] });
    await request(createApp(runtime)).get('/api/executive').set('Cookie', 'painel_docente_session=' + token).expect(401);
    await request(createApp(runtime)).get('/api/monitoring').set('Cookie', 'painel_docente_session=' + token).expect(401);
  }
});
test('Gestão consulta resumo, histórico e detalhes, mas não acessa operações nem destinatários', async (t) => {
  const runtime = await createRuntime({ NODE_ENV: 'test', AUTH_MODE: 'demo', DATA_SOURCE: 'demo' }); t.after(() => runtime.close());
  const app = createApp(runtime); const agent = request.agent(app);
  await agent.get('/api/executive').expect(401);
  const session = await agent.post('/api/auth/demo-login').set('Origin', 'http://localhost:8080').send({ profileId: 'gestao' }).expect(201);
  const overview = await agent.get('/api/executive').expect(200).expect('Cache-Control', 'private, no-store');
  await agent.get('/api/executive/history?period=2026%2F2&snapshotId=' + overview.body.meta.snapshotId).expect(200);
  await agent.get('/api/monitoring?snapshotId=' + overview.body.meta.snapshotId + '&period=2026%2F2&accessScope=semester').expect(200);
  for (const url of ['/api/operations/deadlines', '/api/operations/snapshots', '/api/operations/manual-deliveries', '/api/reports/preview']) await agent.get(url).expect(403);
  for (const url of ['/api/operations/deadlines', '/api/operations/deadlines/preview', '/api/operations/snapshots', '/api/operations/manual-deliveries', '/api/operations/manual-deliveries/revisions', '/api/reports/send']) await agent.post(url).set('Origin', 'http://localhost:8080').set('x-csrf-token', session.body.csrfToken).send({}).expect(403);
  await agent.get('/api/executive?snapshotId=invalido').expect(400);
  await agent.get('/api/executive?sort=desconhecido').expect(400);
  await agent.get('/api/executive/history').expect(400);
});
test('API valida datas inexistentes, formato, intervalo invertido e mantém consulta autorizada', async (t) => {
  const runtime = await createRuntime({ NODE_ENV: 'test', AUTH_MODE: 'demo', DATA_SOURCE: 'demo' }); t.after(() => runtime.close());
  const app = createApp(runtime); const agent = request.agent(app);
  await agent.post('/api/auth/demo-login').set('Origin', 'http://localhost:8080').send({ profileId: 'gestao' }).expect(201);
  const overview = await agent.get('/api/executive').expect(200);
  const scope = { period: overview.body.meta.period, snapshotId: overview.body.meta.snapshotId };
  for (const dates of [
    { dateFrom: '2026-02-30' }, { dateTo: '21/10/2026' }, { dateFrom: '0000-01-01' },
    { dateFrom: '2026-10-20', dateTo: '2026-10-01' }, { dateTo: ['2026-10-01', '2026-10-02'] },
  ]) await agent.get('/api/executive/history').query({ ...scope, ...dates }).expect(400);
  await request(app).get('/api/executive/history').query({ ...scope, dateFrom: '2026-01-01' }).expect(401);
  const empty = await agent.get('/api/executive/history').query({ ...scope, dateFrom: '2099-01-01', dateTo: '2099-12-31' }).expect(200).expect('Cache-Control', 'private, no-store');
  assert.deepEqual(empty.body.points, []);
  const full = await agent.get('/api/executive/history').query(scope).expect(200);
  assert.ok(full.body.points.length > 0);
});
