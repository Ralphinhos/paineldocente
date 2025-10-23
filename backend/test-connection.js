#!/usr/bin/env node

// Script de teste de conexão
// Agora lê variáveis de ambiente direto do Docker
const sql = require('mssql');

console.log('\n🔍 TESTE DE CONEXÃO\n');
console.log('================================');

// Ler variáveis de ambiente
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_HOST = process.env.DB_HOST;
const DB_DATABASE = process.env.DB_DATABASE;

// Verificar se variáveis existem
console.log('🔐 Verificando variáveis de ambiente...');
if (!DB_USER) console.log('❌ DB_USER não definido!');
if (!DB_PASSWORD) console.log('❌ DB_PASSWORD não definido!');
if (!DB_HOST) console.log('❌ DB_HOST não definido!');
if (!DB_DATABASE) console.log('❌ DB_DATABASE não definido!');

if (!DB_USER || !DB_PASSWORD || !DB_HOST || !DB_DATABASE) {
    console.log('\n❌ ERRO: Variáveis de ambiente não configuradas!');
    console.log('💡 Verifique se o arquivo .env existe na raiz do projeto');
    console.log('💡 Execute: docker-compose down && docker-compose up -d');
    process.exit(1);
}

console.log('✅ Todas as variáveis carregadas!\n');

// Configuração conectando ao PROXY local (stunnel)
const dbConfig = {
    user: DB_USER,
    password: DB_PASSWORD,
    server: '127.0.0.1',  // Conecta ao stunnel LOCAL
    port: 1434,            // Porta do stunnel
    database: DB_DATABASE,
    options: {
        encrypt: true,
        trustServerCertificate: true,
        requestTimeout: 30000,
        connectionTimeout: 30000,
    }
};

console.log('📋 Configuração:');
console.log(`   Usuário: ${dbConfig.user}`);
console.log(`   Banco: ${dbConfig.database}`);
console.log(`   Via Proxy: 127.0.0.1:1434`);
console.log(`   Destino Real: ${DB_HOST}:1433`);
console.log('================================\n');

async function testar() {
    let pool;
    try {
        console.log('⏳ Conectando...');
        pool = await new sql.ConnectionPool(dbConfig).connect();
        console.log('✅ CONEXÃO OK!\n');

        console.log('⏳ Testando query...');
        const result = await pool.request().query('SELECT @@VERSION as version, DB_NAME() as database_name');
        console.log('✅ QUERY OK!');
        console.log('\n📊 Informações do Servidor:');
        console.log(`   Versão: ${result.recordset[0].version.split('\n')[0]}`);
        console.log(`   Banco Conectado: ${result.recordset[0].database_name}`);
        console.log('\n🎉 TUDO FUNCIONANDO!\n');
        return true;
    } catch (err) {
        console.error('❌ ERRO:');
        console.error(`   Tipo: ${err.name}`);
        console.error(`   Mensagem: ${err.message}`);
        if (err.code) {
            console.error(`   Código: ${err.code}`);
        }
        console.log('\n💡 Dicas:');
        console.log('   1. Verifique se stunnel está rodando: ps aux | grep stunnel');
        console.log('   2. Verifique as variáveis de ambiente');
        console.log('   3. Teste conexão ao proxy: telnet 127.0.0.1 1434\n');
        return false;
    } finally {
        if (pool) await pool.close();
    }
}

testar().then(ok => process.exit(ok ? 0 : 1));