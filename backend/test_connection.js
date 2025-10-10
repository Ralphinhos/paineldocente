// Carrega as variáveis de ambiente do arquivo .env
// Certifique-se de que você criou um arquivo '.env' na pasta 'backend/'
// a partir do '.env.example' e preencheu com suas credenciais.
require('dotenv').config();

const sql = require('mssql');

// Função de auto-execução para testar a conexão com o banco de dados.
(async () => {
  console.log('Tentando conectar ao banco de dados SQL Server...');

  // Lê a configuração do banco a partir das variáveis de ambiente
  const dbConfig = {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      server: process.env.DB_HOST,
      database: process.env.DB_DATABASE,
      options: {
          encrypt: process.env.DB_ENCRYPT === 'true',
          trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true'
      },
      connectionTimeout: 15000 // Timeout de 15 segundos
  };

  console.log('Usando a seguinte configuração:');
  console.log(`- Servidor (DB_HOST): ${dbConfig.server}`);
  console.log(`- Banco de Dados (DB_DATABASE): ${dbConfig.database}`);
  console.log(`- Usuário (DB_USER): ${dbConfig.user}`);
  console.log(`- Criptografia (DB_ENCRYPT): ${dbConfig.options.encrypt}`);
  console.log(`- Confiar Certificado (DB_TRUST_SERVER_CERTIFICATE): ${dbConfig.options.trustServerCertificate}\n`);

  try {
    // Tenta criar uma conexão
    const pool = await sql.connect(dbConfig);

    console.log('✅ SUCESSO! A conexão com o banco de dados foi estabelecida com êxito.');

    // Fecha a conexão
    await pool.close();
    console.log('Conexão fechada.');

  } catch (err) {
    console.error('❌ ERRO: Falha ao conectar ao banco de dados.');
    console.error('----------------------------------------------------');
    console.error('Possíveis Causas:');
    console.error('1. Credenciais Incorretas: Verifique se DB_USER, DB_PASSWORD, DB_HOST e DB_DATABASE estão corretos no seu arquivo .env.');
    console.error('2. Firewall/Rede: Certifique-se de que a máquina que executa este script tem permissão para acessar o servidor do banco na porta 1433.');
    console.error('3. Configuração SSL/TLS: Tente alterar os valores de DB_ENCRYPT e DB_TRUST_SERVER_CERTIFICATE no seu arquivo .env.');
    console.error('----------------------------------------------------');
    console.error('Detalhes do Erro Original:', err.message);
  }
})();
