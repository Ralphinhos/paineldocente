const test = require('node:test');
const assert = require('node:assert/strict');
const { teacherRanking, delayPoints } = require('../core/ranking');
const { calendarDays, delayFacts } = require('../core/timing');
const { buildSnapshot } = require('../core/rules');
const { DashboardService, groupAssignments, summarize } = require('../services/dashboardService');
const { buildReport, ReportService } = require('../services/reportService');
const { MemoryStore } = require('../services/store');
const { createDemoSource } = require('../data/demoSource');
const catalog = require('../config/rules.json');
const at = '2026-09-11T12:00:00Z';
const policy = catalog.ranking;
function item(status = 'DELIVERED_ON_TIME', daysLate = 0, more = {}) {
  return { id: 'test', baseId: 'test', label: 'Teste', status, daysLate, overdue: status === 'PENDING' && daysLate > 0, deadlineAt: '2026-09-01T12:00:00Z', responsibility: 'ASSIGNED', ...more };
}
function course(requirements, more = {}) {
  return { course: { id: 'c1' }, teacher: { id: 't1', name: 'Docente teste' }, requirements, accessStatus: 'CURRENT', daysSinceAccess: 1, ...more };
}
const rank = (courses) => teacherRanking(courses, at, policy).teachers[0];
test('exemplo aprovado: 80% no prazo, atraso de 2 dias, acesso em dia = 85', () => {
  const result = rank([course([item(), item(), item(), item(), item('DELIVERED_LATE', 2)])]);
  assert.deepEqual(result.components, { onTime: 40, delay: 15, access: 30 });
  assert.equal(result.score, 85);
});
test('atraso em dias civis: mesmo dia, um dia, virada de mês e fuso brasileiro', () => {
  assert.equal(calendarDays('2026-09-02T02:59:00Z', '2026-09-01T12:00:00Z'), 0);
  assert.equal(calendarDays('2026-09-02T03:00:00Z', '2026-09-01T12:00:00Z'), 1);
  assert.equal(calendarDays('2026-09-01', '2026-08-31'), 1);
  assert.equal(calendarDays('2026-09-11', '2026-09-01'), 10);
  assert.equal(delayFacts({ structureStatus: 'PENDING', deadlineAt: '2026-09-11T12:00:00Z' }, '2026-09-12T02:59:59Z').daysLate, 0);
});
test('faixas de atraso cobrem médias fracionárias sem arredondar antes da pontuação', () => {
  for (const [days, points] of [[0, 20], [0.5, 15], [3, 15], [3.01, 10], [7, 10], [7.5, 5], [14, 5], [14.01, 0], [30, 0]]) assert.equal(delayPoints(days, policy), points);
});
test('pendência vencida cresce pela data da coleta e entrega congela duração', () => {
  const raw = createDemoSource(new Date(at));
  const first = buildSnapshot(raw, catalog, { rulesApproved: true, manualDeliveries: raw.manualDeliveries });
  const second = buildSnapshot({ ...raw, generatedAt: '2026-09-12T12:00:00Z' }, catalog, { rulesApproved: true, manualDeliveries: raw.manualDeliveries });
  const get = (snapshot, key) => snapshot.rows.find((row) => row.course.id === '1101' && row.requirement.id === key);
  assert.equal(get(second, 'desafio').daysLate, get(first, 'desafio').daysLate + 1);
  assert.equal(get(second, 'unidades_aprendizagem:1').daysLate, get(first, 'unidades_aprendizagem:1').daysLate);
});
test('entrega só observada em coleta informa limite, nunca duração exata', () => {
  const result = delayFacts({ structureStatus: 'DELIVERED_LATE', deadlineAt: '2026-09-01T12:00:00Z', configuredAt: at, timingSource: 'SNAPSHOT_OBSERVED' }, at);
  assert.equal(result.daysLate, null); assert.equal(result.observedLateDays, 10);
  assert.equal(rank([course([item('DELIVERED_LATE', null)])]).mode, 'INCOMPLETE');
});
test('prazo futuro, dispensa, material herdado e substitutiva não alteram nota', () => {
  const before = rank([course([item()])]);
  const after = rank([course([item(), item('PENDING', 0, { deadlineAt: at }), item('DELIVERED_ON_TIME', 0, { deadlineAt: '2026-09-15T12:00:00Z' }), item('NOT_APPLICABLE', null), item('INHERITED_READY', null), item('PENDING', 90, { baseId: 'substitutiva' })])]);
  assert.equal(after.score, before.score); assert.equal(after.dueItems, 1);
});
test('disciplinas têm peso igual: duplicar quantidade de vídeos não aumenta peso da disciplina', () => {
  const timely = course([item(), item()], { course: { id: 'a' } });
  const late4 = course(Array.from({ length: 4 }, () => item('DELIVERED_LATE', 2)), { course: { id: 'b' } });
  const late8 = course(Array.from({ length: 8 }, () => item('DELIVERED_LATE', 2)), { course: { id: 'b' } });
  assert.equal(rank([timely, late4]).score, rank([timely, late8]).score);
  assert.equal(rank([timely, late4]).onTimePercent, 50);
});
test('acesso usa média por disciplina ativa; encerrada não zera nota', () => {
  const result = rank([course([item()]), course([item()], { course: { id: 'c2' }, accessStatus: 'CRITICAL', daysSinceAccess: 15 }), course([item()], { course: { id: 'c3' }, accessStatus: 'OUTSIDE_WINDOW', daysSinceAccess: null })]);
  assert.equal(result.components.access, 15); assert.equal(result.activeCourses, 2); assert.equal(result.score, 85); assert.equal(result.accessCritical, 1);
});
test('base incompleta não perde pontos nem recebe colocação indevida; somente acesso tem ranking próprio', () => {
  const ranking = teacherRanking([course([item(), item('NOT_VERIFIABLE', null)]), course([item('INHERITED_READY', null)], { teacher: { id: 't2', name: 'Herdado' } })], at, policy);
  assert.equal(ranking.regularity.length, 0); assert.equal(ranking.priority.length, 0);
  assert.equal(ranking.access.length, 2); assert.equal(ranking.incomplete.length, 1);
  assert.equal(ranking.teachers.find((entry) => entry.teacher.id === 't1').score, null);
  assert.equal(ranking.teachers.find((entry) => entry.teacher.id === 't2').mode, 'ACCESS_ONLY');
});
test('múltiplos docentes só recebem nota de entrega com responsabilidade definida', () => {
  const raw = createDemoSource(new Date(at));
  const sourceCourse = raw.courses.find((entry) => entry.id === '1104');
  const snapshot = buildSnapshot(raw, catalog, { rulesApproved: true, manualDeliveries: raw.manualDeliveries });
  const rows = snapshot.rows.filter((row) => row.course.id === '1104' && row.requirement.id === 'avaliacao_final');
  assert.equal(rows.filter((row) => row.requirement.responsibility === 'ASSIGNED').length, 1);
  delete sourceCourse.requirementOwners;
  const unresolved = buildSnapshot(raw, catalog, { rulesApproved: true, manualDeliveries: raw.manualDeliveries });
  const result = teacherRanking(groupAssignments(unresolved.rows.filter((row) => row.course.id === '1104')), at, policy);
  assert.equal(result.incomplete.length, 2); assert.equal(result.regularity.length, 0);
});
test('ranking respeita escopo, período e base inteira; não depende de página ou situação da lista', async () => {
  const store = new MemoryStore(); const raw = createDemoSource(new Date(at));
  await store.saveSnapshot(buildSnapshot(raw, catalog, { manualDeliveries: raw.manualDeliveries }));
  const service = new DashboardService({ store, snapshotIntervalMinutes: 60 });
  const user = { role: 'coordinator', courseIds: ['1101', '1102'] };
  const first = await service.getDashboard(user, { pageSize: 5 });
  const filtered = await service.getDashboard(user, { pageSize: 50, status: 'DELIVERED_LATE' });
  assert.deepEqual(first.ranking, filtered.ranking);
  assert.deepEqual(first.ranking.teachers.map((entry) => entry.teacher.id).sort(), ['501', '502']);
  assert.equal((await service.getDashboard(user, { period: '2099/1' })).ranking.teachers.length, 0);
});
test('substitutiva sai de todas as linhas; evolução nunca mistura versões', async () => {
  const store = new MemoryStore(); const raw = createDemoSource(new Date(at));
  const old = buildSnapshot({ ...raw, generatedAt: '2026-09-04T12:00:00Z' }, { ...catalog, version: 'old' });
  await store.saveSnapshot(old);
  const current = buildSnapshot(raw, catalog, { manualDeliveries: raw.manualDeliveries });
  assert.ok(current.rows.every((row) => row.requirement.baseId !== 'substitutiva'));
  await store.saveSnapshot(current);
  const data = await new DashboardService({ store, snapshotIntervalMinutes: 60 }).getDashboard({ role: 'executive' });
  assert.equal(data.trend.length, 1); assert.equal(data.trend[0].generatedAt, current.generatedAt);
  assert.equal((await store.listSnapshots())[1].rulesVersion, 'old');
});
test('relatório detalhado usa todas as ocorrências e identifica limite do resumo executivo', async () => {
  const store = new MemoryStore(); const raw = createDemoSource(new Date(at));
  const template = raw.courses[0];
  raw.courses = Array.from({ length: 65 }, (_, index) => ({ ...structuredClone(template), id: `c${index}`, shortName: `Curso ${index}`, teachers: [{ ...template.teachers[0], id: `t${index}` }] }));
  const snapshot = buildSnapshot(raw, catalog); await store.saveSnapshot(snapshot);
  const dashboardService = new DashboardService({ store, snapshotIntervalMinutes: 60 });
  const service = new ReportService({ store, dashboardService, config: { reports: { emailEnabled: false, recipients: [] } } });
  const [report] = await service.preview('coordinators', { role: 'ned_admin' });
  assert.equal(report.details.length, 65);
  const full = await dashboardService.getDashboard({ role: 'executive' }, {}, { snapshot, allRows: true });
  const executive = buildReport('executive', full);
  assert.equal(executive.details.length, 5); assert.match(executive.text, /60 outras ocorrências/);
  assert.ok(!executive.text.includes('substitutiva'));
});
test('relatórios de múltiplos destinatários preservam uma única fotografia', async () => {
  let lookups = 0; const captures = [];
  const snapshot = { id: 'fixed' };
  const fakeData = { meta: { snapshotId: 'fixed', generatedAt: at, rulesVersion: 'v', publishAllowed: false }, summary: { courses: 0, monitoredTeachers: 0, requirements: { overdue: 0 }, access: { critical: 0, never: 0 }, averageDaysLate: 0, measuredLateItems: 0 }, rows: [] };
  const service = new ReportService({ store: { latestSnapshot: async () => { lookups++; return snapshot; } }, dashboardService: { getDashboard: async (_user, _filters, options) => { captures.push(options.snapshot); return fakeData; } }, config: { reports: { emailEnabled: false, recipients: [{ audience: 'executive', name: 'A', email: 'a@example.invalid' }, { audience: 'executive', name: 'B', email: 'b@example.invalid' }] } } });
  await service.preview('executive', { role: 'ned_admin' });
  assert.equal(lookups, 1); assert.deepEqual(captures, [snapshot, snapshot]);
});
test('indicadores contam a entrega uma vez e usam o responsável, sem a pendência de outro docente', () => {
  const raw = createDemoSource(new Date(at));
  const snapshot = buildSnapshot(raw, catalog, { manualDeliveries: raw.manualDeliveries });
  const owned = snapshot.rows.find((row) => row.course.id === '1104' && row.requirement.id === 'unidades_aprendizagem:1' && row.requirement.responsibility === 'ASSIGNED');
  const other = snapshot.rows.find((row) => row.course.id === '1104' && row.requirement.id === 'unidades_aprendizagem:1' && row.requirement.responsibility === 'OTHER_TEACHER');
  Object.assign(owned, { structureStatus: 'DELIVERED_ON_TIME', daysLate: 0, overdue: false });
  Object.assign(other, { structureStatus: 'PENDING', daysLate: 10, overdue: true });
  const summary = summarize([owned, other]);
  assert.equal(summary.requirements.total, 1);
  assert.equal(summary.requirements.overdue, 0);
  assert.equal(summary.requirements.deliveredOnTime, 1);
  assert.equal(summary.monitoredTeachers, 2);
});
test('envio rejeita fotografia diferente daquela conferida na prévia', async () => {
  const service = new ReportService({ store: { latestSnapshot: async () => ({ id: 'new', isDemo: true }) }, dashboardService: {}, config: { reports: { emailEnabled: false } } });
  await assert.rejects(service.send('executive', { id: 'ned' }, 'request', 'old'), (error) => error.code === 'STALE_REPORT');
});
test('HTML do relatório escapa nomes e mantém somente entregas do responsável', async () => {
  const raw = createDemoSource(new Date(at)); const snapshot = buildSnapshot(raw, catalog, { manualDeliveries: raw.manualDeliveries });
  const store = new MemoryStore(); await store.saveSnapshot(snapshot);
  const data = await new DashboardService({ store, snapshotIntervalMinutes: 60 }).getDashboard({ role: 'ned_admin' }, {}, { allRows: true });
  data.rows[0].teacher.name = '<img src=x onerror=alert(1)>';
  data.rows[0].severity = 'CRITICAL';
  data.rows[0].requirements.push(item('PENDING', 10, { label: 'Item de outro docente', responsibility: 'OTHER_TEACHER' }));
  const report = buildReport('coordinators', data, '<script>bad</script>');
  assert.ok(!report.html.includes('<script>')); assert.ok(!report.html.includes('<img'));
  assert.ok(report.html.includes('&lt;script&gt;bad&lt;/script&gt;'));
  assert.ok(!report.details[0].reason.includes('Item de outro docente'));
});
