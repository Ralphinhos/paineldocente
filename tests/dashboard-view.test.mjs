import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/dashboardView.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { teacherChartData, deliveryPercent, activityRows, bimestreLabel } = await import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'));
const teacher = (id, changes = {}) => ({ teacher: { id, name: 'Docente ' + id }, mode: 'COMPOSITE', onTimePercent: 80, dueItems: 5, activeCourses: 1, maxDaysSinceAccess: 2, never: 0, ...changes });
const filters = (status = '', more = {}) => ({ status, ...more });
const item = (id, status, more = {}) => ({ id, baseId: id, status, responsibility: 'ASSIGNED', ...more });

test('base incompleta e material herdado não recebem percentual zero ou 100 inventado', () => {
  assert.equal(deliveryPercent(teacher('incompleto', { mode: 'INCOMPLETE' })), null);
  assert.equal(deliveryPercent(teacher('replicado', { mode: 'ACCESS_ONLY', dueItems: 0 })), null);
  const all = teacherChartData([teacher('incompleto', { mode: 'INCOMPLETE' })]);
  assert.equal(all.all[0].late, null);
  assert.equal(all.late.length, 0);
  assert.equal(all.onTime.length, 0);
});
test('Top 10 usa a base completa e ordena percentuais, sem depender da página da planilha', () => {
  const base = Array.from({ length: 30 }, (_, id) => teacher(String(id), { onTimePercent: id }));
  const charts = teacherChartData(base);
  assert.equal(charts.all.length, 30);
  assert.equal(charts.late.length, 10);
  assert.equal(charts.late[0].entry.teacher.id, '0');
  assert.equal(charts.onTime[0].entry.teacher.id, '29');
});
test('acessos usam o maior intervalo ativo; ausência de registro não vira zero nem bom acesso', () => {
  const charts = teacherChartData([
    teacher('recente', { maxDaysSinceAccess: 0 }),
    teacher('sete', { maxDaysSinceAccess: 7 }),
    teacher('oito', { maxDaysSinceAccess: 8 }),
    teacher('quinze', { maxDaysSinceAccess: 15 }),
    teacher('semregistro', { never: 1, maxDaysSinceAccess: null }),
    teacher('misto', { never: 1, maxDaysSinceAccess: 2, activeCourses: 2 }),
    teacher('inativo', { activeCourses: 0, maxDaysSinceAccess: 40 }),
  ]);
  assert.deepEqual(charts.absent.map((entry) => entry.entry.teacher.id).sort(), ['misto', 'oito', 'quinze', 'semregistro']);
  assert.ok(!charts.present.some((entry) => ['misto', 'semregistro', 'inativo'].includes(entry.entry.teacher.id)));
  assert.equal(charts.present[0].entry.teacher.id, 'recente');
  assert.equal(charts.all.find((entry) => entry.entry.teacher.id === 'semregistro').days, null);
  assert.equal(charts.all.find((entry) => entry.entry.teacher.id === 'inativo').days, null);
});
test('planilha mostra uma linha por item, exclui outro responsável e separa pendência vencida', () => {
  const row = { id: 'c1:t1', accessStatus: 'CURRENT', requirements: [item('vencida', 'PENDING', { overdue: true }), item('aberta', 'PENDING', { deadlineAt: '2026-10-20' }), item('outro', 'PENDING', { overdue: true, responsibility: 'OTHER_TEACHER' }), item('sem_prazo', 'PENDING')] };
  assert.equal(activityRows([row], filters()).length, 3);
  assert.deepEqual(activityRows([row], filters('OVERDUE')).map((line) => line.item.id), ['vencida']);
  assert.deepEqual(activityRows([row], filters('WITHIN_DEADLINE')).map((line) => line.item.id), ['aberta']);
  assert.equal(activityRows([row], filters('CURRENT')).length, 3);
});
test('avaliações dos dois bimestres permanecem separadas no filtro e na coluna', () => {
  const first = item('avaliacao_bimestral_1', 'DELIVERED_ON_TIME', { label: 'Avaliação bimestral 1' });
  const second = item('avaliacao_bimestral_2', 'PENDING', { label: 'Avaliação bimestral 2' });
  assert.equal(bimestreLabel(first), '1º');
  assert.equal(bimestreLabel(second), '2º');
  assert.equal(bimestreLabel(item('forum', 'PENDING', { label: 'Fórum' })), '—');
  const row = { id: 'c1:t1', accessStatus: 'CURRENT', requirements: [first, second] };
  assert.deepEqual(activityRows([row], filters('', { requirementId: first.baseId })).map((line) => line.item.id), [first.id]);
});
