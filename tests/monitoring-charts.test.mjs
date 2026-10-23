import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/monitoringCharts.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { integerScale, donutSegments } = await import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'));
const tooltipSource = await readFile(new URL('../src/lib/chartTooltip.ts', import.meta.url), 'utf8');
const tooltipOutput = ts.transpileModule(tooltipSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { tooltipPosition } = await import('data:text/javascript;base64,' + Buffer.from(tooltipOutput).toString('base64'));

test('escala dos gráficos começa em zero, usa inteiros e inclui o maior valor', () => {
  for (const maximum of [0, 1, 2, 7, 14, 18, 101, 9999]) {
    const { ceiling, ticks } = integerScale([0, maximum]);
    assert.equal(ticks[0], 0); assert.equal(ticks.at(-1), ceiling);
    assert.ok(ceiling >= maximum); assert.ok(ceiling > 0);
    assert.ok(ticks.every(Number.isInteger));
    assert.ok(ticks.length >= 2 && ticks.length <= 6);
    for (let i = 1; i < ticks.length; i++) assert.equal(ticks[i] - ticks[i - 1], ticks[1]);
  }
});

test('rosca reconcilia o total sem inventar fatias para estados zerados ou base vazia', () => {
  const values = [34, 9, 5, 0];
  const segments = donutSegments(values);
  assert.equal(segments.reduce((sum, segment) => sum + segment.value, 0), 48);
  assert.ok(Math.abs(segments.reduce((sum, segment) => sum + segment.share, 0) - 1) < 1e-12);
  assert.equal(segments[0].offset, 0);
  assert.equal(segments[3].share, 0);
  assert.deepEqual(donutSegments([0, 0]), [{ value: 0, share: 0, offset: 0 }, { value: 0, share: 0, offset: 0 }]);
  assert.deepEqual(donutSegments([5]), [{ value: 5, share: 1, offset: 0 }]);
  assert.deepEqual(values, [34, 9, 5, 0]);
});

test('escala tolera base vazia e ausências sem alterar a representação dos registros', () => {
  assert.deepEqual(integerScale([]), { ceiling: 1, ticks: [0, 1] });
  const values = [null, 0, 18, NaN, Infinity];
  assert.deepEqual(integerScale(values), { ceiling: 20, ticks: [0, 5, 10, 15, 20] });
  assert.equal(values[0], null); assert.equal(values[1], 0);
});

test('dicas de leitura permanecem dentro da tela nas bordas do gráfico', () => {
  for (const viewport of [{ width: 1366, height: 768 }, { width: 360, height: 640 }]) {
    const size = { width: 300, height: 290 };
    for (const anchor of [{ x: 0, y: 0 }, { x: viewport.width - 1, y: viewport.height - 1 }, { x: viewport.width / 2, y: 100 }]) {
      const position = tooltipPosition(anchor, size, viewport);
      assert.ok(position.left >= 12); assert.ok(position.top >= 12);
      assert.ok(position.left + size.width <= viewport.width - 12);
      assert.ok(position.top + size.height <= viewport.height - 12);
    }
  }
});
