const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const request = require('supertest');
const { createRuntime } = require('../runtime');
const { createApp } = require('../app');
const { MemoryStore } = require('../services/store');
const { SnapshotService } = require('../services/snapshotService');
const { validCivilDate, civilDateToIso, civilDates, applyDeadlineCatalog } = require('../core/deadlines');
const { createDemoSource } = require('../data/demoSource');
const { loadCatalog } = require('../core/rules');
const path = require('node:path');

const env = { NODE_ENV: 'test', APP_ORIGIN: 'http://localhost:8080', AUTH_MODE: 'demo', DATA_SOURCE: 'demo', SNAPSHOT_STORE: 'memory', EMAIL_SEND_ENABLED: 'false', RULES_APPROVED: 'false' };
async function setup(t, profile = 'ned') {
  const runtime = await createRuntime(env); t.after(() => runtime.close());
  const agent = request.agent(createApp(runtime));
  const login = await agent.post('/api/auth/demo-login').set('Origin', env.APP_ORIGIN).send({ profileId: profile }).expect(201);
  return { runtime, agent, csrf: login.body.csrfToken, actor: { id: 'demo:ned', name: 'Equipe NED', role: 'ned_admin' } };
}
async function draft(runtime, requirementId = 'desafio', courseId = '1101') {
  const snapshot = await runtime.services.store.latestSnapshot();
  const course = snapshot.rows.find((row) => row.course.id === courseId).course;
  const version = await runtime.services.store.latestDeadlineCatalog();
  return { snapshotId: snapshot.id, expectedVersionId: version?.id || null, period: course.period, modality: course.modality, courseIds: [course.id], changes: [{ requirementId, dates: ['2030-10-30'] }], reason: 'Calendário do NED conferido para teste.' };
}
const post = (agent, csrf, url) => agent.post(url).set('Origin', env.APP_ORIGIN).set('x-csrf-token', csrf);

test('datas civis rejeitam dia impossível e preservam o dia brasileiro', () => {
  for (const value of ['2026-02-30', '2026-13-01', '', null, '2026-2-01']) assert.equal(validCivilDate(value), false);
  assert.equal(validCivilDate('2028-02-29'), true); assert.equal(validCivilDate('2026-10-30'), true);
  assert.equal(civilDateToIso('2026-10-30'), '2026-10-30T15:00:00.000Z');
});

test('cadastro exige autenticação, papel NED, origem e proteção CSRF', async (t) => {
  const { runtime, agent } = await setup(t, 'gestao');
  await request(createApp(runtime)).get('/api/operations/deadlines').expect(401);
  await agent.get('/api/operations/deadlines').expect(403);
  const admin = request.agent(createApp(runtime));
  const login = await admin.post('/api/auth/demo-login').set('Origin', env.APP_ORIGIN).send({ profileId: 'ned' }).expect(201);
  const input = await draft(runtime);
  await admin.post('/api/operations/deadlines/preview').send(input).expect(403);
  await admin.post('/api/operations/deadlines/preview').set('Origin', env.APP_ORIGIN).send(input).expect(403);
  await post(admin, login.body.csrfToken, '/api/operations/deadlines/preview').send(input).expect(200);
});

test('tela oferece prazos dos dois bimestres e pacote único de UAs', async (t) => {
  const { runtime, agent } = await setup(t);
  const input = await draft(runtime, 'avaliacao_bimestral_1', '1103');
  const view = await agent.get('/api/operations/deadlines').query({ period: input.period, modality: 'SEMESTRAL' }).expect(200);
  assert.ok(view.body.requirements.some((row) => row.id === 'avaliacao_bimestral_1'));
  assert.ok(view.body.requirements.some((row) => row.id === 'avaliacao_bimestral_2'));
  assert.equal(view.body.requirements.filter((row) => row.id === 'unidades_aprendizagem').length, 1);
  assert.ok(!view.body.requirements.some((row) => row.id === 'substitutiva'));
  assert.match(view.headers['cache-control'], /no-store/);
});

test('prévia não escreve; confirmação salva histórico, recalcula e preserva a coleta anterior', async (t) => {
  const { runtime, agent, csrf } = await setup(t);
  const input = await draft(runtime); const before = await runtime.services.store.latestSnapshot();
  const preview = await post(agent, csrf, '/api/operations/deadlines/preview').send(input).expect(200);
  assert.equal(preview.body.impact.length, 1); assert.deepEqual(preview.body.impact[0].after, ['2030-10-30']);
  assert.equal(await runtime.services.store.latestDeadlineCatalog(), null);
  const saved = await post(agent, csrf, '/api/operations/deadlines').send({ ...input, reviewToken: preview.body.reviewToken }).expect(201);
  assert.equal(saved.body.collected, true); assert.equal(saved.body.version.revision, 1);
  const after = await runtime.services.store.latestSnapshot();
  assert.notEqual(after.id, before.id); assert.equal(after.deadlineVersionId, saved.body.version.id);
  const changed = after.rows.find((row) => row.course.id === '1101' && row.requirement.id === 'desafio');
  assert.equal(changed.deadlineAt, '2030-10-30T15:00:00.000Z'); assert.equal(changed.overdue, false);
  assert.deepEqual(runtime.services.store.snapshots.find((item) => item.id === before.id), before);
  const view = await agent.get('/api/operations/deadlines').expect(200);
  assert.equal(view.body.history[0].createdBy, 'Equipe NED — Demonstração');
  assert.equal(view.body.history[0].reason, input.reason); assert.equal(view.body.meta.pendingCollection, false);
  assert.ok(runtime.services.store.auditEvents.some((event) => event.action === 'DEADLINE_CATALOG_SAVED'));
});

test('datas individuais de vídeo respeitam a carga horária e alteram cada item', async (t) => {
  const { runtime, agent, csrf } = await setup(t); const input = await draft(runtime, 'videos');
  input.changes[0].dates = ['2030-10-01', '2030-10-08', '2030-10-15'];
  await post(agent, csrf, '/api/operations/deadlines/preview').send(input).expect(400);
  input.changes[0].dates.push('2030-10-22');
  const preview = await post(agent, csrf, '/api/operations/deadlines/preview').send(input).expect(200);
  await post(agent, csrf, '/api/operations/deadlines').send({ ...input, reviewToken: preview.body.reviewToken }).expect(201);
  const latest = await runtime.services.store.latestSnapshot();
  const videos = latest.rows.filter((row) => row.course.id === '1101' && row.requirement.baseId === 'videos').sort((a, b) => a.requirement.itemNumber - b.requirement.itemNumber);
  assert.deepEqual(videos.map((row) => row.deadlineAt), input.changes[0].dates.map(civilDateToIso));
});

test('alterações fora do recorte, substitutiva, datas inválidas e duplicação são recusadas', async (t) => {
  const { runtime, agent, csrf } = await setup(t); const input = await draft(runtime);
  const variants = [
    { ...input, changes: [{ requirementId: 'desafio', dates: ['2026-02-30'] }] },
    { ...input, changes: [{ requirementId: 'substitutiva', dates: ['2030-10-01'] }] },
    { ...input, courseIds: ['1103'] },
    { ...input, courseIds: ['1101', '1101'] },
    { ...input, changes: [...input.changes, ...input.changes] },
    { ...input, reason: ' ' },
  ];
  for (const value of variants) await post(agent, csrf, '/api/operations/deadlines/preview').send(value).expect(400);
  assert.equal(await runtime.services.store.latestDeadlineCatalog(), null);
});

test('confirmação é vinculada ao conteúdo, usuário e prazo de validade', async (t) => {
  const { runtime, actor } = await setup(t); const service = runtime.services.deadlineService; const input = await draft(runtime);
  const preview = await service.preview(input, actor);
  await assert.rejects(service.save({ ...input, reason: 'Outro motivo' }, preview.reviewToken, actor, 'tamper'), (error) => error.code === 'DEADLINES_REVIEW_REQUIRED');
  await assert.rejects(service.save(input, preview.reviewToken, { ...actor, id: 'outro' }, 'other'), (error) => error.code === 'DEADLINES_REVIEW_REQUIRED');
  const old = Date.now() - 16 * 60000;
  await assert.rejects(service.save(input, old + '.' + service.token(service.normalize(input), actor.id, old), actor, 'expired'), (error) => error.code === 'DEADLINES_REVIEW_REQUIRED');
  await assert.rejects(service.save(input, Date.now() + '.' + 'é'.repeat(43), actor, 'malformed'), (error) => error.code === 'DEADLINES_REVIEW_REQUIRED');
  assert.equal(await runtime.services.store.latestDeadlineCatalog(), null);
});

test('duas conferências antigas não sobrescrevem o calendário salvo', async (t) => {
  const { runtime, actor } = await setup(t); const service = runtime.services.deadlineService;
  const input = await draft(runtime); const first = await service.preview(input, actor); const second = await service.preview(input, actor);
  await service.save(input, first.reviewToken, actor, 'first');
  await assert.rejects(service.save(input, second.reviewToken, actor, 'second'), (error) => error.code === 'DEADLINES_STALE');
  assert.equal((await runtime.services.store.listDeadlineCatalogs()).length, 1);
});

test('falha da coleta preserva datas, bloqueia publicação e impede coleta da versão antiga', async (t) => {
  const { runtime, actor } = await setup(t); const { store, deadlineService, snapshotService, monitoringService } = runtime.services;
  const input = await draft(runtime); const preview = await deadlineService.preview(input, actor);
  const old = await store.latestSnapshot(); const run = snapshotService.run.bind(snapshotService);
  snapshotService.run = async () => { throw new Error('SQL indisponível simulado'); };
  const result = await deadlineService.save(input, preview.reviewToken, actor, 'failed');
  assert.equal(result.collected, false); assert.ok(await store.latestDeadlineCatalog());
  const data = await monitoringService.getMonitoring(actor); assert.equal(data.meta.deadlinesChanged, true); assert.equal(data.meta.publishAllowed, false);
  await assert.rejects(store.saveSnapshot({ ...old, id: crypto.randomUUID() }), (error) => error.code === 'DEADLINES_STALE');
  snapshotService.run = run; const refreshed = await snapshotService.run();
  assert.equal(refreshed.deadlineVersionId, result.version.id);
  assert.equal((await monitoringService.getMonitoring(actor)).meta.deadlinesChanged, false);
});

test('nova coleta exige nova conferência antes de salvar os prazos', async (t) => {
  const { runtime, actor } = await setup(t); const input = await draft(runtime); const service = runtime.services.deadlineService;
  const preview = await service.preview(input, actor); await runtime.services.snapshotService.run();
  await assert.rejects(service.save(input, preview.reviewToken, actor, 'stale'), (error) => error.code === 'DEADLINES_STALE');
});

test('uma nova versão manual mantém o prazo próprio após alteração do calendário', async (t) => {
  const { runtime, agent, csrf } = await setup(t);
  const snapshot = await runtime.services.store.latestSnapshot();
  const item = snapshot.rows.find((row) => row.course.id === '1101' && row.requirement.id === 'videos:1');
  await post(agent, csrf, '/api/operations/manual-deliveries/revisions').send({ snapshotId: snapshot.id, courseId: '1101', teacherId: item.teacher.id, requirementId: 'videos', itemNumber: 1, reason: 'Regravação aprovada.', deadlineDate: '2030-10-01' }).expect(201);
  const input = await draft(runtime, 'videos');
  const preview = await post(agent, csrf, '/api/operations/deadlines/preview').send(input).expect(200);
  assert.equal(preview.body.impact[0].hasOwnRevisionDeadline, true);
  await post(agent, csrf, '/api/operations/deadlines').send({ ...input, reviewToken: preview.body.reviewToken }).expect(201);
  const latest = await runtime.services.store.latestSnapshot();
  const revised = latest.rows.find((row) => row.course.id === '1101' && row.requirement.id === 'videos:1');
  assert.equal(revised.deadlineSource, 'MANUAL_REVISION'); assert.equal(revised.manualRevisionDeadlineDate, '2030-10-01');
  assert.equal(latest.rows.find((row) => row.course.id === '1101' && row.requirement.id === 'videos:2').deadlineAt, '2030-10-30T15:00:00.000Z');
});

test('worker consulta o calendário persistido em cada coleta sem reiniciar', async (t) => {
  const { runtime, actor } = await setup(t); const { store, deadlineService } = runtime.services;
  const input = await draft(runtime); const preview = await deadlineService.preview(input, actor);
  await deadlineService.save(input, preview.reviewToken, actor, 'worker');
  let seen;
  const raw = createDemoSource(new Date(), 3);
  const source = { async fetch(calendar) { seen = calendar; return applyDeadlineCatalog(raw, calendar); } };
  const worker = new SnapshotService({ source, store, catalog: loadCatalog(path.join(__dirname, '../config/rules.json')), dataSource: 'moodle', rulesApproved: false });
  const collected = await worker.run();
  assert.equal(seen.version, (await store.latestDeadlineCatalog()).catalog.version);
  assert.equal(collected.deadlineVersionId, (await store.latestDeadlineCatalog()).id);
});

test('reserva atômica do calendário recusa escritores concorrentes sem perda de histórico', async () => {
  const store = new MemoryStore(); const snapshotId = crypto.randomUUID();
  await store.saveSnapshot({ id: snapshotId, generatedAt: new Date().toISOString(), rows: [] });
  const entry = { id: crypto.randomUUID(), catalog: { periods: {} }, sourceSnapshotId: snapshotId, createdAt: new Date().toISOString(), createdBy: 'NED', actorId: 'ned', reason: 'Calendário conferido', impact: [], courseCount: 1, changeCount: 1 };
  const results = await Promise.allSettled([store.saveDeadlineCatalog(entry, null), store.saveDeadlineCatalog({ ...entry, id: crypto.randomUUID() }, null)]);
  assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal((await store.listDeadlineCatalogs()).length, 1); assert.equal(store.auditEvents.length, 1);
});

test('aplicação em lote preserva atividades e disciplinas fora da alteração', async (t) => {
  const { runtime, actor } = await setup(t); const input = await draft(runtime, 'unidades_aprendizagem');
  const before = await runtime.services.store.latestSnapshot();
  input.courseIds = [...new Set(before.rows.filter((row) => row.course.period === input.period && row.course.modality === input.modality).map((row) => row.course.id))];
  assert.ok(input.courseIds.length > 1);
  const service = runtime.services.deadlineService; const review = await service.preview(input, actor);
  assert.equal(review.courseCount, input.courseIds.length);
  await service.save(input, review.reviewToken, actor, 'batch');
  const after = await runtime.services.store.latestSnapshot();
  for (const row of after.rows) {
    const previous = before.rows.find((candidate) => candidate.course.id === row.course.id && candidate.teacher.id === row.teacher.id && candidate.requirement.id === row.requirement.id);
    if (input.courseIds.includes(row.course.id) && row.requirement.baseId === 'unidades_aprendizagem') assert.equal(row.deadlineAt, civilDateToIso('2030-10-30'));
    else assert.deepEqual(civilDates(row.deadlineAt), civilDates(previous.deadlineAt));
  }
});

test('bimestres recebem datas distintas sem misturar requisitos', async (t) => {
  const { runtime, actor } = await setup(t); const input = await draft(runtime, 'avaliacao_bimestral_1', '1103');
  input.changes = [{ requirementId: 'avaliacao_bimestral_1', dates: ['2030-10-10'] }, { requirementId: 'avaliacao_bimestral_2', dates: ['2030-11-10'] }];
  const service = runtime.services.deadlineService; const review = await service.preview(input, actor);
  await service.save(input, review.reviewToken, actor, 'bimestres');
  const snapshot = await runtime.services.store.latestSnapshot();
  for (const item of input.changes) assert.equal(snapshot.rows.find((row) => row.course.id === '1103' && row.requirement.id === item.requirementId).deadlineAt, civilDateToIso(item.dates[0]));
});

test('relatório não sai com calendário alterado mesmo se a coleta anterior estava liberada', async (t) => {
  const { runtime, actor } = await setup(t); const { store, deadlineService, snapshotService, reportService } = runtime.services;
  const before = await store.latestSnapshot(); const input = await draft(runtime); const review = await deadlineService.preview(input, actor);
  snapshotService.run = async () => { throw new Error('Coleta indisponível'); };
  await deadlineService.save(input, review.reviewToken, actor, 'blocked-report');
  store.latestSnapshot = async () => ({ ...before, source: 'moodle', isDemo: false, publishAllowed: true, qualityStatus: 'VALID', qualityIssues: [] });
  let sends = 0; reportService.transporter = { async sendMail() { sends++; } };
  const previews = await reportService.preview('coordinators', actor);
  assert.ok(previews.every((row) => row.publishAllowed === false));
  await assert.rejects(reportService.send('coordinators', actor, 'blocked', before.id, ['tecnologia.demo@example.invalid']), (error) => error.code === 'QUALITY_GATE_BLOCKED');
  assert.equal(sends, 0);
});

test('módulo começa sem vínculos e oferece somente as datas do print correspondente', async (t) => {
  const { runtime, agent } = await setup(t);
  const first = await agent.get('/api/operations/deadlines').query({ period: '2026/2', modality: 'GRADUACAO_EAD', calendarGroup: 'M1' }).expect(200);
  assert.equal(first.body.scope.length, 0);
  assert.equal(first.body.filters.courses.find((course) => course.id === '1101').calendarGroup, null);
  assert.equal(first.body.referenceDates.avaliacao_final, '2026-09-21');
  const second = await runtime.services.deadlineService.view({ period: '2026/2', modality: 'GRADUACAO_EAD', calendarGroup: 'M2' });
  assert.equal(second.referenceDates.avaliacao_final, '2026-11-09');
  assert.equal(second.referenceDates.forum_diagnostico, '2026-09-28');
  assert.ok(!('videos' in second.referenceDates));
  assert.equal(await runtime.services.store.latestDeadlineCatalog(), null);
  const otherSemester = await runtime.services.deadlineService.view({ period: '2027/1', modality: 'GRADUACAO_EAD', calendarGroup: 'M1' });
  assert.deepEqual(otherSemester.referenceDates, {});
});

test('Modular mantém M1 e M2 independentes e preserva as demais disciplinas', async (t) => {
  const { runtime, actor } = await setup(t); const service = runtime.services.deadlineService;
  const before = await runtime.services.store.latestSnapshot();
  for (const [courseId, calendarGroup, date] of [['1102', 'M1', '2026-08-31'], ['1104', 'M2', '2026-11-03']]) {
    const input = { ...await draft(runtime, 'avaliacao_final', courseId), calendarGroup, changes: [{ requirementId: 'avaliacao_final', dates: [date] }] };
    const preview = await service.preview(input, actor);
    assert.equal((await service.view({ period: input.period, modality: 'MODULAR', calendarGroup })).scope.length, 0);
    await service.save(input, preview.reviewToken, actor, 'module-' + calendarGroup);
  }
  const first = await service.view({ period: '2026/2', modality: 'MODULAR', calendarGroup: 'M1' });
  const second = await service.view({ period: '2026/2', modality: 'MODULAR', calendarGroup: 'M2' });
  assert.deepEqual(first.scope.map((course) => course.id), ['1102']); assert.deepEqual(second.scope.map((course) => course.id), ['1104']);
  assert.deepEqual(first.requirements.find((item) => item.id === 'avaliacao_final').dates, ['2026-08-31']);
  assert.deepEqual(second.requirements.find((item) => item.id === 'avaliacao_final').dates, ['2026-11-03']);
  const after = await runtime.services.store.latestSnapshot();
  for (const row of after.rows.filter((item) => !['1102', '1104'].includes(item.course.id))) {
    assert.deepEqual(civilDates(row.deadlineAt), civilDates(before.rows.find((item) => item.course.id === row.course.id && item.teacher.id === row.teacher.id && item.requirement.id === row.requirement.id).deadlineAt));
  }
});

test('Semestral separa bimestres e modelos sem criar novos critérios de cobrança', async (t) => {
  const { runtime, actor } = await setup(t); const service = runtime.services.deadlineService;
  const first = await service.view({ period: '2026/2', modality: 'SEMESTRAL', calendarGroup: 'COM_EGI', bimester: '1' });
  const second = await service.view({ period: '2026/2', modality: 'SEMESTRAL', calendarGroup: 'COM_EGI', bimester: '2' });
  assert.ok(first.requirements.some((item) => item.id === 'avaliacao_bimestral_1'));
  assert.ok(!first.requirements.some((item) => item.id === 'avaliacao_bimestral_2' || item.id === 'desafio'));
  assert.ok(second.requirements.some((item) => item.id === 'avaliacao_bimestral_2'));
  assert.ok(!second.requirements.some((item) => item.id === 'avaliacao_bimestral_1'));
  assert.ok(!('agenda_quiz_1' in first.referenceDates));
  const withoutEgi = await service.view({ period: '2026/2', modality: 'SEMESTRAL', calendarGroup: 'SEM_EGI', bimester: '2' });
  assert.equal(withoutEgi.referenceDates.agenda_quiz_2, '2026-09-28');
  assert.equal(withoutEgi.requirements.find((item) => item.id === 'agenda_quiz_2').agendaOnly, true);
  for (const [bimester, id, date] of [['1', 'avaliacao_bimestral_1', '2026-09-21'], ['2', 'avaliacao_bimestral_2', '2026-10-26']]) {
    const input = { ...await draft(runtime, id, '1103'), calendarGroup: 'COM_EGI', bimester, changes: [{ requirementId: id, dates: [date] }] };
    const preview = await service.preview(input, actor); await service.save(input, preview.reviewToken, actor, 'bimester-' + bimester);
  }
  const current = await runtime.services.store.latestSnapshot();
  assert.equal(current.rows.find((row) => row.course.id === '1103' && row.requirement.id === 'avaliacao_bimestral_1').deadlineAt, civilDateToIso('2026-09-21'));
  assert.equal(current.rows.find((row) => row.course.id === '1103' && row.requirement.id === 'avaliacao_bimestral_2').deadlineAt, civilDateToIso('2026-10-26'));
});

test('agenda de substitutiva e fechamento não altera entregas, prazos avaliados ou quantidade de requisitos', async (t) => {
  const { runtime, actor } = await setup(t); const service = runtime.services.deadlineService;
  const before = await runtime.services.store.latestSnapshot();
  const input = { ...await draft(runtime, 'avaliacao_final', '1104'), calendarGroup: 'M2', changes: [
    { requirementId: 'substitutiva', dates: ['2026-11-27'] }, { requirementId: 'agenda_fechamento', dates: ['2026-12-04'] },
  ] };
  const preview = await service.preview(input, actor); await service.save(input, preview.reviewToken, actor, 'agenda');
  const after = await runtime.services.store.latestSnapshot();
  const facts = (snapshot) => snapshot.rows.map((row) => [row.course.id, row.teacher.id, row.requirement.id, row.structureStatus, civilDates(row.deadlineAt)]);
  assert.deepEqual(facts(after), facts(before));
  const view = await service.view({ period: input.period, modality: input.modality, calendarGroup: 'M2' });
  assert.deepEqual(view.requirements.find((item) => item.id === 'substitutiva').dates, ['2026-11-27']);
});

test('vínculo pode ser salvo sem alterar datas e reclassificação aparece na conferência', async (t) => {
  const { runtime, actor } = await setup(t); const service = runtime.services.deadlineService;
  for (const calendarGroup of ['M1', 'M2']) {
    const input = { ...await draft(runtime), calendarGroup, changes: [] };
    const preview = await service.preview(input, actor);
    assert.equal(preview.impact.length, 1); assert.equal(preview.impact[0].kind, 'GROUP');
    assert.match(preview.impact[0].after[0], new RegExp(calendarGroup));
    if (calendarGroup === 'M2') assert.match(preview.impact[0].before[0], /M1/);
    await service.save(input, preview.reviewToken, actor, 'classify-' + calendarGroup);
  }
  assert.equal((await service.view({ period: '2026/2', modality: 'GRADUACAO_EAD', calendarGroup: 'M1' })).scope.length, 0);
  assert.equal((await service.view({ period: '2026/2', modality: 'GRADUACAO_EAD', calendarGroup: 'M2' })).scope.length, 1);
});

test('módulo, modelo, bimestre e atividade incompatíveis são recusados pela API', async (t) => {
  const { runtime, agent, csrf } = await setup(t);
  const base = await draft(runtime); const sem = await draft(runtime, 'avaliacao_bimestral_1', '1103');
  for (const input of [
    { ...base, calendarGroup: 'COM_EGI' }, { ...base, calendarGroup: 'M1', bimester: '1' },
    { ...sem, calendarGroup: 'M1', bimester: '1' }, { ...sem, calendarGroup: 'COM_EGI' },
    { ...sem, calendarGroup: 'COM_EGI', bimester: '2' },
    { ...sem, calendarGroup: 'COM_EGI', bimester: '1', changes: [{ requirementId: 'agenda_quiz_1', dates: ['2026-08-10'] }] },
  ]) await post(agent, csrf, '/api/operations/deadlines/preview').send(input).expect(400);
  await agent.get('/api/operations/deadlines').query({ calendarGroup: 'M1' }).expect(400);
  assert.equal(await runtime.services.store.latestDeadlineCatalog(), null);
});

test('conferência é vinculada ao módulo e aos bimestres antes de salvar', async (t) => {
  const { runtime, actor } = await setup(t); const service = runtime.services.deadlineService;
  const input = { ...await draft(runtime), calendarGroup: 'M1' };
  const preview = await service.preview(input, actor);
  await assert.rejects(service.save({ ...input, calendarGroup: 'M2' }, preview.reviewToken, actor, 'other-module'), (error) => error.code === 'DEADLINES_REVIEW_REQUIRED');
  assert.equal(await runtime.services.store.latestDeadlineCatalog(), null);
});
