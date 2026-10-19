import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/monitoringCharts.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { integerScale } = await import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'));

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

test('escala tolera base vazia e ausências sem alterar a representação dos registros', () => {
  assert.deepEqual(integerScale([]), { ceiling: 1, ticks: [0, 1] });
  const values = [null, 0, 18, NaN, Infinity];
  assert.deepEqual(integerScale(values), { ceiling: 20, ticks: [0, 5, 10, 15, 20] });
  assert.equal(values[0], null); assert.equal(values[1], 0);
});
