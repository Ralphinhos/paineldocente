import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// Run the same presentation code used by the UI; no browser or extra package needed.
const source = await readFile(new URL('../src/lib/presentation.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { deliveryPresentation, formatDate } = await import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'));
const item = (status, more = {}) => ({ status, daysLate: null, observedLateDays: null, delayPrecision: 'UNAVAILABLE', ...more });

test('data civil brasileira não é invertida nem deslocada pelo fuso', () => {
  assert.equal(formatDate('2026-06-02'), '02/06/2026');
  assert.equal(formatDate('2026-09-06'), '06/09/2026');
  assert.equal(formatDate('2026-09-02T02:59:00Z'), '01/09/2026');
  assert.equal(formatDate('2026-02-30', 'A validar'), 'A validar');
  assert.equal(formatDate('inválida'), '—');
});
test('pendência no prazo, vencida e sem prazo têm rótulos distintos', () => {
  assert.equal(deliveryPresentation(item('PENDING', { deadlineAt: '2026-09-15', daysLate: 0 })).label, 'Pendente no prazo');
  assert.deepEqual(deliveryPresentation(item('PENDING', { overdue: true, daysLate: 4 })), { label: 'Pendente em atraso', detail: '4 dias de atraso', tone: 'danger' });
  assert.equal(deliveryPresentation(item('PENDING', { overdue: true })).detail, 'Dias a validar');
  assert.equal(deliveryPresentation(item('PENDING')).label, 'Prazo a validar');
  assert.equal(deliveryPresentation(item('PENDING', { deadlineAt: '2026-02-30' })).label, 'Prazo a validar');
});
test('atraso observado não aparece como duração exata', () => {
  assert.equal(deliveryPresentation(item('DELIVERED_LATE', { delayPrecision: 'EXACT', daysLate: 2 })).detail, '2 dias');
  assert.equal(deliveryPresentation(item('DELIVERED_LATE', { delayPrecision: 'OBSERVED', observedLateDays: 10 })).detail, 'Até 10 dias · a validar');
  assert.equal(deliveryPresentation(item('DELIVERED_LATE')).detail, 'Dias a validar');
});
test('antecipação exige data comprovada e compara o dia em São Paulo', () => {
  const manual = item('DELIVERED_ON_TIME', { delayPrecision: 'EXACT', evidenceDate: '2026-09-01', deadlineAt: '2026-09-02' });
  assert.equal(deliveryPresentation(manual).label, 'Entregue antecipadamente');
  assert.equal(deliveryPresentation({ ...manual, evidenceDate: '2026-09-02' }).label, 'Entregue no prazo');
  assert.equal(deliveryPresentation({ ...manual, evidenceDate: null, configuredAt: '2026-09-02T02:59:00Z', timingSource: 'DEMO_TRUSTED' }).label, 'Entregue antecipadamente');
  assert.equal(deliveryPresentation({ ...manual, evidenceDate: '2026-02-30' }).label, 'Entregue no prazo');
});
test('coleta observada e data sem origem comprovada não inventam antecipação', () => {
  const observed = item('DELIVERED_ON_TIME', { configuredAt: '2026-09-01', deadlineAt: '2026-09-02', delayPrecision: 'EXACT', timingSource: 'SNAPSHOT_OBSERVED' });
  assert.equal(deliveryPresentation(observed).label, 'Entregue no prazo');
  assert.equal(deliveryPresentation({ ...observed, timingSource: null }).label, 'Entregue no prazo');
});
test('replicação pronta, dispensa e evidência incompleta continuam separadas', () => {
  assert.equal(deliveryPresentation(item('INHERITED_READY')).label, 'Replicado no prazo');
  assert.equal(deliveryPresentation(item('NOT_APPLICABLE')).label, 'Não aplicável');
  assert.equal(deliveryPresentation(item('NOT_VERIFIABLE')).label, 'A validar');
});
