const assert = require('assert');
const { processData } = require('./dataProcessor');

// Cenário de teste: Entrega realizada ANTES do prazo.
const testDataAntecipado = [
    {
        'Docente': 'Professor Teste',
        'Disciplina': 'Teste de Software',
        'Curso': 'Ciência da Computação',
        'Data Limite Construção': '15/10/2024',
        'Entregue': '10/10/2024', // Entregue 5 dias antes
    }
];

// Executa o processamento dos dados de teste
const processedData = processData(testDataAntecipado);
const result = processedData[0];

console.log('--- Executando Teste de Entrega Antecipada ---');
console.log(`Resultado Atual - Status: "${result.statusCalculado}"`);
console.log(`Resultado Atual - Dias: ${result.diasCalculado}`);
console.log('-------------------------------------------');

const expectedStatus = 'Entregue com 5 dia(s) de antecedência';
const expectedDias = 0;

// Verificação do Comportamento Esperado (DEVE FALHAR ANTES DA CORREÇÃO)
try {
    assert.strictEqual(result.statusCalculado, expectedStatus, `O status esperado era "${expectedStatus}"`);
    assert.strictEqual(result.diasCalculado, expectedDias, `O valor de diasCalculado esperado era ${expectedDias}`);

    console.log('✅ Teste passou: O comportamento está correto.');

} catch (error) {
    console.error('❌ Teste falhou como esperado (antes da correção).');
    console.error(`Detalhe: ${error.message}`);
    //process.exit(1); // Comentado para não parar o fluxo em automação, mas indica falha.
}
