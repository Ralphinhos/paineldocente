import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const { createRuntime } = require('../backend/runtime.js');
let vite; let runtime; let modules;
const admin = { role: 'ned_admin' };
const filters = { period: '', modality: '', courseId: '', teacherId: '', query: '', accessStatus: 'ISSUES', deliveryStatus: 'OVERDUE', page: 1 };
const noop = () => {};
before(async () => {
  runtime = await createRuntime({ NODE_ENV: 'test', DATA_SOURCE: 'demo', AUTH_MODE: 'demo', EMAIL_SEND_ENABLED: 'false' });
  vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  modules = await Promise.all(['AccessOverview', 'DeliveryOverview', 'MonitoringFilters', 'DeliveryDetails', 'MonitoringChart', 'DeadlinePanel'].map((name) => vite.ssrLoadModule(`/src/components/dashboard/${name}.tsx`)));
});
after(async () => { await vite?.close(); await runtime?.close(); });
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));

test('componentes reais apresentam acesso global e filtro de docente com dados da API', async () => {
  const selected = { ...filters, accessStatus: 'ALL', teacherId: '502' };
  const data = await runtime.services.monitoringService.getMonitoring(admin, selected);
  const html = render(modules[0].AccessOverview, { data: data.access, filters: selected, disabled: false, onChange: noop, onTeacher: noop, onDeliveries: noop });
  assert.match(html, /Docente Beta/); assert.ok(!html.includes('Docente Alfa'));
  assert.match(html, /<strong>2<\/strong>/);
  assert.match(html, /Em dia/); assert.ok(!html.includes('Ranking'));
  const controls = render(modules[2].MonitoringFilters, { value: selected, options: data.filters, disabled: false, onChange: noop });
  assert.match(controls, /value="Docente Beta/);
  assert.match(controls, /role="combobox"/);
  assert.match(controls, /Docente Beta/);
});

test('tabela de problemas mostra dias de atraso e somente pendências ainda abertas', async () => {
  const data = await runtime.services.monitoringService.getMonitoring(admin, filters);
  const html = render(modules[1].DeliveryOverview, { data: data.deliveries, filters, disabled: false, onChange: noop, onTeacher: noop, onOpen: noop, onManual: noop });
  const tbody = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1];
  assert.ok(tbody); assert.match(tbody, /Pendente em atraso/); assert.match(tbody, /7 dias de atraso/);
  assert.ok(!tbody.includes('Entregue com atraso'));
  assert.ok(!tbody.includes('Avaliação substitutiva'));
  assert.equal((tbody.match(/<tr>/g) || []).length, data.deliveries.rows.length);
  assert.match(html, /Registrar UA e videoaulas/);
});

test('resolvidas e antecipadas possuem rótulos corretos; nomes externos são escapados', async () => {
  const selected = { ...filters, deliveryStatus: 'DELIVERED_LATE' };
  const data = await runtime.services.monitoringService.getMonitoring(admin, selected);
  const html = render(modules[1].DeliveryOverview, { data: data.deliveries, filters: selected, disabled: false, onChange: noop, onTeacher: noop, onOpen: noop, onManual: noop });
  const tbody = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1];
  assert.match(tbody, /Entregue com atraso/); assert.ok(!tbody.includes('Pendente em atraso'));
  const early = await runtime.services.monitoringService.getMonitoring(admin, { ...filters, deliveryStatus: 'EARLY' });
  const row = structuredClone(early.deliveries.rows[0]); row.teacher.name = '<img src=x onerror=alert(1)>';
  const details = render(modules[3].DeliveryDetails, { row, onClose: noop });
  assert.match(details, /Entregue antecipadamente/); assert.ok(!details.includes('<img'));
  assert.match(details, /&lt;img/);
});

test('comprovação até uma data não é mostrada como entrega exata ou antecipada', async () => {
  const data = await runtime.services.monitoringService.getMonitoring(admin, { ...filters, deliveryStatus: 'ALL' });
  const row = structuredClone(data.deliveries.rows[0]);
  Object.assign(row.item, { baseId: 'desafio', label: 'Desafio', manualControl: false, status: 'DELIVERED_ON_TIME', overdue: false,
    configuredAt: null, manualEvidenceDate: null, readyByAt: '2026-08-24T15:00:00Z', deadlineAt: '2026-08-25T15:00:00Z', timingSource: 'MOODLE_READY_BY_BOUND', delayPrecision: 'EXACT', daysLate: 0 });
  const html = render(modules[3].DeliveryDetails, { row, onClose: noop });
  assert.match(html, /<dt>Preparo comprovado até<\/dt><dd>24\/08\/2026<\/dd>/);
  assert.match(html, /Entregue no prazo/); assert.doesNotMatch(html, /Entregue antecipadamente/);
});

test('gráfico distingue acesso medido de zero dias de ausência de data', () => {
  const html = render(modules[4].MonitoringChart, {
    title: 'Acessos', description: 'Último acesso ao ambiente', unit: 'dias sem acessar',
    disabled: false, onSelect: noop, empty: 'Sem docentes', footnote: 'Dados da coleta',
    bars: [
      { id: 'hoje', label: 'Docente Hoje', value: 0, detail: 'Em dia', tone: 'green' },
      { id: 'sem-data', label: 'Docente sem data', value: null, detail: 'Dados a conferir', tone: 'slate' },
      { id: 'sem-registro', label: 'Docente sem registro', value: null, unavailableLabel: 'Sem registro', detail: 'Sem acesso registrado', tone: 'purple' },
    ],
  });
  assert.match(html, /Docente Hoje: 0 dias sem acessar/);
  assert.match(html, /Docente sem data: A validar/);
  assert.match(html, /Docente sem registro: Sem registro/);
  assert.ok(!/Docente sem (?:data|registro): 0/.test(html));
  assert.ok(!html.includes('NaN'));
});

test('recorte vazio não apresenta docentes inexistentes como regulares', async () => {
  const selected = { ...filters, teacherId: 'inexistente' };
  const data = await runtime.services.monitoringService.getMonitoring(admin, selected);
  const html = render(modules[0].AccessOverview, { data: data.access, filters: selected, disabled: false, onChange: noop, onTeacher: noop, onDeliveries: noop });
  assert.match(html, /Nenhum docente neste recorte/);
  assert.ok(!html.includes('Os docentes verificados estão em dia'));
  assert.ok(!html.includes('NaN')); assert.ok(!html.includes('Infinity'));
});

test('Top 10 limita o desenho mesmo ao receber mil docentes sem cortar nomes acessíveis', () => {
  const bars = Array.from({ length: 1000 }, (_, index) => ({ id: String(index), label: 'Docente com nome completo para identificação ' + index, value: 10000 - index, detail: 'Registro confirmado', tone: 'blue' }));
  const html = render(modules[4].MonitoringChart, { title: 'Top 10', description: 'Maior intervalo', unit: 'dias', bars, empty: 'Sem docentes', footnote: 'Recorte completo', disabled: false, onSelect: noop });
  assert.equal((html.match(/role="button"/g) || []).length, 10);
  assert.match(html, /Docente com nome completo para identificação 9: 9\.991 dias/);
  assert.ok(!html.includes('identificação 10:'));
  assert.match(html, /viewBox="0 0 640 448"/);
  assert.ok(!html.includes('NaN')); assert.ok(!html.includes('Infinity'));
});

test('prazos apresentam M1 e M2 separados com seleção identificada para leitura assistiva', async () => {
  for (const modality of ['GRADUACAO_EAD', 'MODULAR']) {
    const data = await runtime.services.deadlineService.view({ period: '2026/2', modality, calendarGroup: 'M2' });
    const html = render(modules[5].AcademicCalendarSelector, { groups: data.filters.calendarGroups, value: 'M2', bimester: '1', semestral: false, disabled: false, onGroup: noop, onBimester: noop });
    assert.match(html, /Módulo 1 · M1/); assert.match(html, /Módulo 2 · M2/);
    assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1);
    assert.doesNotMatch(html, /Período completo|bimestre/);
  }
});

test('prazos semestrais permitem modelo com/sem EGI e bimestre sem opção de período completo', async () => {
  const data = await runtime.services.deadlineService.view({ period: '2026/2', modality: 'SEMESTRAL', calendarGroup: 'SEM_EGI', bimester: '2' });
  const html = render(modules[5].AcademicCalendarSelector, { groups: data.filters.calendarGroups, value: 'SEM_EGI', bimester: '2', semestral: true, disabled: true, onGroup: noop, onBimester: noop });
  assert.match(html, /Com EGI/); assert.match(html, /Sem EGI/);
  assert.match(html, /1º bimestre/); assert.match(html, /value="2" selected=""/);
  assert.match(html, /disabled=""/); assert.doesNotMatch(html, /Período completo/);
});
