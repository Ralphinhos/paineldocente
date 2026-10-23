import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const { createRuntime } = require('../backend/runtime.js');
let vite; let runtime; let overview; let table; let evolution; let deliveries; let workspace; let auth; let login; let shell;
const noop = () => {};
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));
before(async () => {
  runtime = await createRuntime({ NODE_ENV: 'test', DATA_SOURCE: 'demo', AUTH_MODE: 'demo' });
  vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  [overview, table, evolution, deliveries, workspace, auth, login, shell] = await Promise.all([
    '/src/components/dashboard/SemesterOverview.tsx', '/src/components/dashboard/SemesterTeacherTable.tsx',
    '/src/components/dashboard/SemesterEvolution.tsx', '/src/components/dashboard/DeliveryOverview.tsx',
    '/src/lib/workspace.ts', '/src/contexts/auth.ts', '/src/pages/LoginPage.tsx', '/src/components/layout/AppShell.tsx',
  ].map((name) => vite.ssrLoadModule(name)));
});
after(async () => { await vite?.close(); await runtime?.close(); });

test('resumo real exibe as quatro comparações, bases explícitas e estados sem valores inválidos', async () => {
  const data = await runtime.services.executiveService.getOverview();
  const html = render(overview.SemesterOverview, { data, disabled: false });
  for (const label of ['Maior proporção de atrasos', 'Maior proporção no prazo', 'Mais dias sem acesso', 'Acessos mais recentes', 'Acessos ao ambiente', 'Situação das entregas']) assert.ok(html.includes(label));
  assert.match(html, /prazos encerrados/); assert.match(html, /Sem registro/); assert.match(html, /0–7/); assert.match(html, /8–14/);
  assert.ok(!html.includes('NaN')); assert.ok(!html.includes('Infinity')); assert.ok(!html.includes('Acima de 4'));
});
test('tabela mantém o ID da coleta e o docente no link, com texto externo escapado', async () => {
  const data = await runtime.services.executiveService.getOverview();
  const id = data.teachers.rows[0].teacher.id;
  data.teachers.rows[0].teacher.name = '<img src=x onerror=alert(1)>';
  const html = render(table.SemesterTeacherTable, { data, query: '', sort: 'late', disabled: false, onQuery: noop, onSort: noop, onPage: noop });
  assert.match(html, /&lt;img/); assert.ok(!html.includes('<img'));
  assert.ok(html.includes('snapshotId=' + data.meta.snapshotId)); assert.ok(html.includes('teacherId=' + id));
  assert.match(html, /acompanhamento\?/); assert.match(html, /accessScope=semester/);
});
test('links das comparações preservam semestre, bimestre e base e não permitem destino externo', () => {
  const snapshotId = '11111111-1111-4111-8111-111111111111';
  const href = workspace.detailHref({ period: '2026/2', modality: 'SEMESTRAL', bimester: '2', snapshotId }, { section: 'deliveries', teacherId: 'docente&x=1', deliveryStatus: 'LATE_ALL', deadlineScope: 'closed' });
  const url = new URL(href, 'http://localhost:8080');
  assert.equal(url.origin, 'http://localhost:8080'); assert.equal(url.pathname, '/acompanhamento');
  assert.equal(url.searchParams.get('teacherId'), 'docente&x=1');
  const filters = workspace.initialDetailFilters(url.search);
  assert.equal(filters.snapshotId, snapshotId); assert.equal(filters.bimester, '2'); assert.equal(filters.deadlineScope, 'closed'); assert.equal(filters.deliveryStatus, 'LATE_ALL');
  assert.equal(workspace.summaryHref(url.search), '/gestao?period=2026%2F2&modality=SEMESTRAL&bimester=2&snapshotId=' + snapshotId);
});
test('detalhamento em leitura mostra evidências, mas não oferece registro de UA ou vídeo', async () => {
  const filters = { ...workspace.initialDetailFilters(''), deliveryStatus: 'ALL', accessStatus: 'ALL' };
  const data = await runtime.services.monitoringService.getMonitoring({ role: 'executive' }, filters);
  const html = render(deliveries.DeliveryOverview, { data: data.deliveries, filters, disabled: false, canManage: false, onChange: noop, onTeacher: noop, onOpen: noop, onManual: noop });
  assert.ok(!html.includes('Registrar UA')); assert.ok(!html.includes('>Registrar</button>'));
  assert.match(html, /Conferir /); assert.match(html, /Entregas|entregas/);
});
test('evolução tem uma ação acessível por referência e nenhuma série duplica os totais', async () => {
  const data = await runtime.services.executiveService.getOverview();
  const history = await runtime.services.executiveService.getHistory({ period: data.meta.period, snapshotId: data.meta.snapshotId });
  const html = render(evolution.SemesterEvolution, { points: history.points, range: history.range, onRangeChange: noop, loading: false, error: null, onRetry: noop, onSelect: noop });
  assert.equal((html.match(/role="button"/g) || []).length, history.points.length);
  assert.ok(!html.includes('<polyline'));
  assert.match(html, /barras empilhadas/);
  assert.match(html, /Pendente vencida/); assert.match(html, /Entregue com atraso/);
  for (const point of history.points) assert.equal(point.total, point.onTime + point.overdue + point.deliveredLate + point.pending + point.validation);
  assert.ok(!html.includes('NaN'));
});
test('período da evolução permanece na URL e no retorno dos detalhes; datas inválidas são descartadas', () => {
  const range = workspace.initialEvolutionRange('?dateFrom=2026-10-01&dateTo=2026-10-20');
  assert.deepEqual(range, { dateFrom: '2026-10-01', dateTo: '2026-10-20' });
  assert.equal(workspace.evolutionRangeError(range), '');
  assert.ok(workspace.evolutionRangeError({ dateFrom: '2026-10-20', dateTo: '2026-10-01' }));
  assert.deepEqual(workspace.initialEvolutionRange('?dateFrom=2026-02-30&dateTo=0000-01-01'), { dateFrom: '', dateTo: '' });
  const href = workspace.detailHref({ period: '2026/2', snapshotId: '11111111-1111-4111-8111-111111111111' }, { ...range, section: 'deliveries' });
  const returned = new URL(workspace.summaryHref(new URL(href, 'http://localhost').search), 'http://localhost');
  assert.deepEqual(workspace.initialEvolutionRange(returned.search), range);
});
test('evolução oferece datas rotuladas e estados de período vazio, único ponto e erro', () => {
  const props = { range: { dateFrom: '2026-10-01', dateTo: '2026-10-20' }, onRangeChange: noop, points: [], loading: false, error: null, onRetry: noop, onSelect: noop };
  const empty = render(evolution.SemesterEvolution, props);
  assert.match(empty, /Data inicial/); assert.match(empty, /Data final/); assert.match(empty, /Aplicar/); assert.match(empty, /Limpar/);
  assert.match(empty, /value="2026-10-01"/); assert.match(empty, /somente as datas das coletas/);
  assert.match(empty, /Nenhuma coleta comparável neste período/); assert.ok(!empty.includes('<polyline'));
  const single = render(evolution.SemesterEvolution, { ...props, points: [{ snapshotId: 'coleta', generatedAt: '2026-10-15T15:00:00Z', total: 0, onTime: 0, overdue: 0, deliveredLate: 0, pending: 0, validation: 0 }] });
  assert.match(single, /outra coleta é necessária/); assert.match(single, /Total de itens: 0/);
  assert.ok(!single.includes('NaN')); assert.ok(!single.includes('Infinity'));
  const invalid = render(evolution.SemesterEvolution, { ...props, range: { dateFrom: '2026-10-20', dateTo: '2026-10-01' } });
  assert.match(invalid, /role="alert"/); assert.match(invalid, /aria-invalid="true"/); assert.match(invalid, /type="submit" class="primary-button" disabled/);
  const failed = render(evolution.SemesterEvolution, { ...props, error: 'Histórico indisponível.' });
  assert.match(failed, /Recarregar evolução/); assert.match(failed, /Histórico indisponível/);
});
test('barras empilhadas preservam totais e não criam referências para semanas sem coleta', () => {
  const points = ['2026-10-01', '2026-10-08', '2026-10-22'].map((day, i) => ({ snapshotId: String(i), generatedAt: day + 'T15:00:00Z', total: i + 1, onTime: i + 1, overdue: 0, deliveredLate: 0, pending: 0, validation: 0 }));
  const html = render(evolution.SemesterEvolution, { points, range: { dateFrom: '', dateTo: '' }, onRangeChange: noop, loading: false, error: null, onRetry: noop, onSelect: noop });
  assert.equal((html.match(/role="button"/g) || []).length, points.length);
  assert.ok(!html.includes('15/10'));
  const totals = [...html.matchAll(/class="ned-bar-value" aria-hidden="true">(\d+)<\/text>/g)].map((match) => Number(match[1]));
  assert.deepEqual(totals, points.map((point) => point.total));
  assert.ok(!html.includes('<polyline')); assert.ok(!html.includes('NaN'));
});
test('entrada oferece somente NED e Alta Gestão; navegação da Gestão é de consulta', () => {
  const state = { user: null, demoEnabled: true, demoProfiles: runtime.config.auth.demoProfiles, loginDemo: noop, error: null };
  const html = renderToStaticMarkup(React.createElement(auth.AuthContext.Provider, { value: state }, React.createElement(login.LoginPage)));
  assert.match(html, /Abrir demonstração do NED/); assert.match(html, /Abrir Alta Gestão/);
  assert.equal((html.match(/<button/g) || []).length, 2);
  const layout = renderToStaticMarkup(React.createElement(auth.AuthContext.Provider, { value: { ...state, user: { name: 'Gestão', role: 'executive' }, logout: noop } }, React.createElement(shell.AppShell, { workspace: 'executive', header: React.createElement('h1', null, 'Panorama') }, 'Conteúdo')));
  assert.match(layout, /Detalhamento/); assert.match(layout, /Alta Gestão · Consulta/);
});
