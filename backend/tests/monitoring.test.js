const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const request = require('supertest');
const { calculateEnvironmentAccess } = require('../core/environmentAccess');
const { buildSnapshot, loadCatalog } = require('../core/rules');
const { buildMonitoring } = require('../core/monitoring');
const { createDemoSource } = require('../data/demoSource');
const { normalizeRows } = require('../data/moodleSource');
const { MemoryStore } = require('../services/store');
const { MonitoringService } = require('../services/monitoringService');
const { createRuntime } = require('../runtime');
const { createApp } = require('../app');

const at = '2026-10-19T12:00:00.000Z';
const catalog = loadCatalog(path.join(__dirname, '../config/rules.json'));
const admin = { role: 'ned_admin' };
const snapshotOf = (raw) => buildSnapshot(raw, catalog, { manualDeliveries: raw.manualDeliveries, rulesApproved: true });
const day = (days) => new Date(Date.parse(at) - days * 86400000).toISOString();

test('acesso global respeita 0–7 / 8–14 / 15+ usando dias civis da coleta', () => {
  for (const [days, status] of [[0, 'CURRENT'], [7, 'CURRENT'], [8, 'ATTENTION'], [14, 'ATTENTION'], [15, 'CRITICAL'], [28, 'CRITICAL']]) {
    const result = calculateEnvironmentAccess({ environmentAccessKnown: true, environmentLastAccessAt: day(days), lastAccessAt: day(90), accessEvents: [{ occurredAt: day(0) }] }, at, catalog.accessThresholds);
    assert.equal(result.status, status);
    assert.equal(result.daysSinceAccess, days);
  }
  const midnight = calculateEnvironmentAccess({ environmentAccessKnown: true, environmentLastAccessAt: '2026-10-11T02:59:00Z' }, '2026-10-19T03:01:00Z', catalog.accessThresholds);
  assert.equal(midnight.daysSinceAccess, 9);
});

test('acesso ausente, nunca registrado e futuro são estados distintos; logs da disciplina não os preenchem', () => {
  const teacher = { lastAccessAt: at, accessEvents: [{ occurredAt: at }] };
  assert.equal(calculateEnvironmentAccess(teacher, at, catalog.accessThresholds).status, 'NOT_VERIFIABLE');
  assert.equal(calculateEnvironmentAccess({ ...teacher, environmentAccessKnown: true }, at, catalog.accessThresholds).status, 'NEVER');
  assert.equal(calculateEnvironmentAccess({ environmentAccessKnown: true, environmentLastAccessAt: day(-1) }, at, catalog.accessThresholds).status, 'NOT_VERIFIABLE');
});

test('SQL normalizado preserva o acesso global separado do acesso à disciplina, inclusive zero', () => {
  const base = { course_id: 1, course_name: 'Disciplina 40h', course_shortname: 'D-2026-2-40h', startdate: 1782864000, enddate: 1798675200, teacher_id: 20, teacher_name: 'Teste', teacher_email: null, assigned_at: 1782864000, last_access_at: 1782864000, modality_field_value: 'Modular', workload_value: '40h', environment_last_access_at: Date.parse(day(2)) / 1000 };
  const deadlines = { version: 'test', periods: {} };
  const teacher = normalizeRows([base], at, deadlines).courses[0].teachers[0];
  assert.equal(teacher.environmentLastAccessAt, day(2));
  assert.notEqual(teacher.lastAccessAt, teacher.environmentLastAccessAt);
  const never = normalizeRows([{ ...base, environment_last_access_at: 0 }], at, deadlines).courses[0].teachers[0];
  assert.equal(never.environmentAccessKnown, true); assert.equal(never.environmentLastAccessAt, null);
  const missing = normalizeRows([{ ...base, environment_last_access_at: undefined }], at, deadlines).courses[0].teachers[0];
  assert.equal(missing.environmentAccessKnown, false);
});

test('docente com material replicado e acesso antigo à disciplina pode estar em dia no ambiente', () => {
  const result = buildMonitoring(snapshotOf(createDemoSource(at)).rows, at);
  const teacher = result.access.rows.find((row) => row.teacher.id === '502');
  assert.equal(teacher.status, 'CURRENT'); assert.equal(teacher.daysSinceAccess, 2);
  assert.ok(result.deliveries.rows.filter((row) => row.teacher.id === '502').every((row) => row.displayStatus === 'INHERITED_READY'));
});

test('acesso global conta cada docente uma vez e permanece igual ao filtrar uma de suas disciplinas', async () => {
  const raw = createDemoSource(at);
  raw.courses = [raw.courses[0], { ...structuredClone(raw.courses[0]), id: '999', shortName: 'Outra disciplina', teachers: [{ ...raw.courses[0].teachers[0], lastAccessAt: day(40) }] }];
  const store = new MemoryStore(); await store.saveSnapshot(snapshotOf(raw));
  const service = new MonitoringService({ store, snapshotIntervalMinutes: 60 });
  const all = await service.getMonitoring(admin, { accessStatus: 'ALL' });
  const filtered = await service.getMonitoring(admin, { courseId: '999', accessStatus: 'ALL' });
  assert.equal(all.access.summary.total, 1);
  assert.equal(all.access.rows[0].courses.length, 2);
  assert.equal(all.access.rows[0].daysSinceAccess, filtered.access.rows[0].daysSinceAccess);
});

test('mesmo nome não une docentes diferentes e timestamps globais conflitantes exigem revisão', () => {
  const raw = createDemoSource(at);
  raw.courses[1].teachers[0].name = raw.courses[0].teachers[0].name;
  const snapshot = snapshotOf(raw);
  assert.equal(buildMonitoring(snapshot.rows, at).access.rows.length, 6);
  const duplicate = structuredClone(snapshot.rows[0]);
  duplicate.course.id = 'outra'; duplicate.environmentAccess.lastAccessAt = day(3);
  const result = buildMonitoring([snapshot.rows[0], duplicate], at);
  assert.equal(result.access.summary.validation, 1);
  assert.equal(result.access.summary.current, 0);
  raw.courses.push({ ...structuredClone(raw.courses[0]), id: 'outro-curso', teachers: [{ ...raw.courses[0].teachers[0], environmentLastAccessAt: day(3) }] });
  const conflicting = snapshotOf(raw);
  assert.ok(conflicting.qualityIssues.some((issue) => issue.code === 'ENVIRONMENT_ACCESS_CONFLICT'));
  assert.equal(conflicting.publishAllowed, false);
});

test('consulta vazia não é publicada como se todos estivessem em dia', () => {
  const raw = { ...createDemoSource(at), source: 'moodle', courses: [] };
  const snapshot = snapshotOf(raw);
  assert.ok(snapshot.qualityIssues.some((issue) => issue.code === 'EMPTY_COURSE_SCOPE'));
  assert.equal(snapshot.publishAllowed, false);
});

test('pendência cresce até entregar; atraso concluído congela e sai das ocorrências abertas', () => {
  const raw = createDemoSource(at);
  const find = (source) => buildMonitoring(snapshotOf(source).rows, source.generatedAt).deliveries.rows.find((row) => row.id === '1101:desafio');
  assert.equal(find(raw).item.daysLate, 7);
  raw.generatedAt = day(-3);
  assert.equal(find(raw).item.daysLate, 10);
  const activity = raw.courses[0].activities.find((item) => item.requirementId === 'desafio');
  Object.assign(activity, { visible: true, configuredAt: day(-3), configurationTimeSource: 'DEMO_TRUSTED' });
  assert.equal(find(raw).displayStatus, 'DELIVERED_LATE');
  assert.equal(find(raw).item.daysLate, 10);
  raw.generatedAt = day(-10);
  assert.equal(find(raw).item.daysLate, 10);
});

test('responsável indefinido e evidência incompleta não viram cobranças confirmadas', () => {
  const raw = createDemoSource(at);
  raw.courses[3].requirementOwners = {};
  raw.courses[3].activities.find((item) => item.requirementId === 'desafio').visible = false;
  const result = buildMonitoring(snapshotOf(raw).rows, at);
  const record = result.deliveries.rows.find((row) => row.id === '1104:desafio');
  assert.equal(record.displayStatus, 'NOT_VERIFIABLE');
  assert.equal(record.item.reasonCode, 'OWNER_UNCONFIRMED');
  assert.ok(result.deliveries.summary.validation > 0);
});

test('totais reconciliam com categorias exclusivas e preservam antecipadas, bimestres e controles manuais', () => {
  const result = buildMonitoring(snapshotOf(createDemoSource(at)).rows, at);
  const a = result.access.summary; const d = result.deliveries.summary;
  assert.equal(a.total, a.current + a.attention + a.critical + a.never + a.validation);
  assert.equal(d.total, d.overdue + d.pendingInTime + d.deliveredLate + d.early + d.onTime + d.inherited + d.validation);
  assert.ok(d.early > 0); assert.ok(d.inherited > 0); assert.ok(d.deliveredLate > 0); assert.ok(d.pendingInTime > 0);
  assert.ok(result.deliveries.rows.some((row) => row.item.baseId === 'avaliacao_bimestral_1'));
  assert.ok(result.deliveries.rows.some((row) => row.item.baseId === 'avaliacao_bimestral_2'));
  assert.ok(!result.deliveries.rows.some((row) => row.item.baseId === 'substitutiva'));
  for (const row of result.deliveries.rows) assert.equal(row.item.manualControl, ['videos', 'unidades_aprendizagem'].includes(row.item.baseId));
});

test('filtro de docente restringe as duas abas; situações e paginação não mudam a base dos gráficos', async () => {
  const store = new MemoryStore(); await store.saveSnapshot(snapshotOf(createDemoSource(at)));
  const service = new MonitoringService({ store, snapshotIntervalMinutes: 60 });
  const overview = await service.getMonitoring(admin, { teacherId: '501', accessStatus: 'ALL', deliveryStatus: 'ALL', pageSize: 5 });
  const issues = await service.getMonitoring(admin, { teacherId: '501', deliveryStatus: 'OVERDUE', pageSize: 5 });
  assert.equal(overview.access.summary.total, 1);
  assert.ok(overview.deliveries.rows.every((row) => row.teacher.id === '501'));
  assert.deepEqual(overview.deliveries.summary, issues.deliveries.summary);
  assert.deepEqual(overview.deliveries.chart, issues.deliveries.chart);
  assert.deepEqual(overview.access.panorama, issues.access.panorama);
  assert.equal(overview.access.panorama.length, 1);
  assert.equal(overview.access.panorama[0].teacher.id, '501');
  assert.ok(overview.deliveries.pagination.total > overview.deliveries.rows.length);
  assert.ok(issues.deliveries.rows.every((row) => row.displayStatus === 'OVERDUE'));
  const compliant = await service.getMonitoring(admin, { deliveryStatus: 'COMPLIANT', pageSize: 50 });
  assert.ok(compliant.deliveries.rows.every((row) => ['EARLY', 'ON_TIME', 'INHERITED_READY'].includes(row.displayStatus)));
  assert.equal(compliant.deliveries.pagination.total, compliant.deliveries.summary.early + compliant.deliveries.summary.onTime + compliant.deliveries.summary.inherited);
});

test('panorama usa todos os docentes autorizados, sem depender da página; desconhecidos não viram zero', async () => {
  const snapshot = snapshotOf(createDemoSource(at));
  const template = snapshot.rows[0];
  snapshot.rows = Array.from({ length: 23 }, (_, index) => ({
    ...structuredClone(template), teacher: { ...template.teacher, id: String(index), name: 'Docente ' + index },
    environmentAccess: index === 22 ? { status: 'NOT_VERIFIABLE', lastAccessAt: null, daysSinceAccess: null } : { status: index >= 15 ? 'CRITICAL' : index >= 8 ? 'ATTENTION' : 'CURRENT', lastAccessAt: day(index), daysSinceAccess: index },
  }));
  const store = new MemoryStore(); await store.saveSnapshot(snapshot);
  const service = new MonitoringService({ store, snapshotIntervalMinutes: 60 });
  const first = await service.getMonitoring(admin, { accessStatus: 'ALL', pageSize: 5 });
  const second = await service.getMonitoring(admin, { accessStatus: 'CRITICAL', pageSize: 5, page: 2 });
  assert.equal(first.access.rows.length, 5);
  assert.equal(first.access.panorama.length, 23);
  assert.deepEqual(first.access.panorama, second.access.panorama);
  assert.equal(first.access.panorama[0].daysSinceAccess, 21);
  assert.equal(first.access.panorama.at(-1).daysSinceAccess, null);
  assert.equal(first.access.panorama.find((row) => row.teacher.id === '0').daysSinceAccess, 0);
  const restricted = await service.getMonitoring({ role: 'coordinator', courseIds: ['unrelated'] }, { accessStatus: 'ALL' });
  assert.deepEqual(restricted.access.panorama, []);
});

test('API exige autenticação, valida filtros, preserva escopo e aplica docente também ao controle manual', async () => {
  const runtime = await createRuntime({ NODE_ENV: 'test', DATA_SOURCE: 'demo', AUTH_MODE: 'demo', APP_ORIGIN: 'http://localhost:8080' });
  try {
    const app = createApp(runtime); const agent = request.agent(app);
    await agent.get('/api/monitoring').expect(401);
    await agent.post('/api/auth/demo-login').set('Origin', 'http://localhost:8080').send({ profileId: 'coordenacao' }).expect(201);
    const scoped = await agent.get('/api/monitoring?accessStatus=ALL&deliveryStatus=ALL').expect(200);
    assert.deepEqual(scoped.body.filters.teachers.map((row) => row.value).sort(), ['501', '502']);
    assert.ok(scoped.body.deliveries.rows.every((row) => ['1101', '1102'].includes(row.course.id)));
    await agent.get('/api/monitoring?accessStatus=INVALID').expect(400);
    await agent.get('/api/monitoring?pageSize=NaN').expect(400);
    await agent.post('/api/auth/demo-login').set('Origin', 'http://localhost:8080').send({ profileId: 'ned' }).expect(201);
    const manual = await agent.get('/api/operations/manual-deliveries?teacherId=501').expect(200);
    assert.ok(manual.body.items.length > 0);
    assert.ok(manual.body.items.every((row) => row.teacher.id === '501'));
  } finally { await runtime.close(); }
});
