const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const dotenv = require('dotenv');
const { loadConfig } = require('../config');

const LOOPBACK = '127.0.0.1';
const APP_ORIGIN = 'http://127.0.0.1:8080';
const PILOT_EMAIL = 'piloto.local@example.invalid';
const fields = ['MOODLE_DB_SERVER', 'MOODLE_DB_PORT', 'MOODLE_DB_DATABASE', 'MOODLE_DB_USER', 'MOODLE_DB_PASSWORD',
  'MOODLE_DB_CA_FILE', 'MOODLE_COURSE_IDS', 'MOODLE_CATEGORY_ROOT', 'MOODLE_TEACHER_ROLE_ID', 'MOODLE_QUERY_WINDOW_DAYS', 'MOODLE_REQUEST_TIMEOUT_MS'];
const configError = (message) => Object.assign(new Error(message), { code: 'PILOT_CONFIG' });

function pilotEnvironment(input, root) {
  if (input.NODE_ENV === 'production') throw configError('O piloto local não pode ser iniciado em produção.');
  const flags = Object.fromEntries(['PILOT_TRUST_SERVER_CERTIFICATE', 'PILOT_INCLUDE_HIDDEN_COURSES'].map((field) => {
    const value = (input[field] || 'false').trim().toLowerCase();
    if (!['true', 'false'].includes(value)) throw configError(field + ' deve ser true ou false.');
    return [field, value];
  }));
  for (const field of ['MOODLE_DB_SERVER', 'MOODLE_DB_DATABASE', 'MOODLE_DB_USER', 'MOODLE_DB_PASSWORD']) {
    if (!input[field]?.trim() || /^(SEU_|PREENCHA_|SUBSTITUIR)/i.test(input[field])) throw configError('Preencha ' + field + ' no arquivo .env.piloto.');
  }
  if (/[\\,]|:\/\//.test(input.MOODLE_DB_SERVER)) throw configError('Use o host/IP em MOODLE_DB_SERVER e a porta TCP em MOODLE_DB_PORT, sem nome de instância.');
  const settings = Object.fromEntries(fields.filter((field) => typeof input[field] === 'string' && input[field] !== '').map((field) => [field, input[field]]));
  if (settings.MOODLE_DB_CA_FILE) settings.MOODLE_DB_CA_FILE = path.resolve(root, settings.MOODLE_DB_CA_FILE);
  const environment = {
    ...settings, NODE_ENV: 'development', PORT: '3001', APP_ORIGIN,
    AUTH_MODE: 'proxy', DEMO_AUTH_ENABLED: 'false', COOKIE_SECURE: 'false', TRUST_PROXY: 'false',
    JWT_SECRET: crypto.randomBytes(48).toString('base64url'), AUTH_PROXY_SHARED_SECRET: crypto.randomBytes(48).toString('base64url'),
    AUTH_USERS_JSON: JSON.stringify([{ email: PILOT_EMAIL, name: 'NED — Piloto local', role: 'ned_admin', courseIds: [] }]),
    DATA_SOURCE: 'moodle', SNAPSHOT_STORE: 'memory', RULES_APPROVED: 'false',
    RULE_CATALOG_PATH: path.join(root, 'backend/config/rules.json'),
    MOODLE_DEADLINE_CATALOG_PATH: path.join(root, 'backend/config/deadlines.json'),
    EMAIL_SEND_ENABLED: 'false', REPORT_RECIPIENTS_JSON: '[]',
    ...flags,
  };
  let config;
  try { config = loadConfig(environment); } catch { throw configError('Confira os campos de .env.piloto: porta, limites e até 10 IDs numéricos de disciplinas.'); }
  if (!config.moodle.courseIds.length) throw configError('Informe de 1 a 10 IDs reais em MOODLE_COURSE_IDS. Nenhuma consulta ampla é executada sem a amostra.');
  return environment;
}

function assertLocalPilotConfig(config) {
  if (config.production || config.appOrigin !== APP_ORIGIN || config.dataSource !== 'moodle' || config.snapshotStore !== 'memory'
    || config.auth.mode !== 'proxy' || config.auth.demoEnabled || config.reports.emailEnabled || config.rules.approved || !config.moodle.courseIds.length) {
    throw configError('As opções do piloto só podem ser usadas no teste local, com amostra limitada, e-mails e publicação desligados.');
  }
}

function pilotRuntimeOptions(environment) {
  assertLocalPilotConfig(loadConfig(environment));
  return { trustServerCertificate: environment.PILOT_TRUST_SERVER_CERTIFICATE === 'true', includeHiddenCourses: environment.PILOT_INCLUDE_HIDDEN_COURSES === 'true' };
}

function loadPilotEnvironment(root, environment = process.env) {
  if (environment.NODE_ENV === 'production') throw configError('O piloto local não pode ser iniciado em produção.');
  let input;
  try { input = dotenv.parse(fs.readFileSync(path.join(root, '.env.piloto'))); }
  catch { throw configError('Crie .env.piloto: copy .env.piloto.example .env.piloto, e preencha os dados localmente.'); }
  return pilotEnvironment(input, root);
}

function pilotErrorMessage(error) {
  if (['PILOT_CONFIG', 'PILOT_COURSES_MISSING', 'COURSE_SCOPE_VIOLATION', 'COURSE_SCOPE_INCOMPLETE'].includes(error.code)) return error.message;
  if (/certificate|self.signed|unable to verify|hostname.*cert/i.test(String(error.message || '') + ' ' + String(error.originalError?.message || ''))) return 'Certificado SQL não validado. Confirme o nome DNS e solicite a CA à TI; informe o arquivo em MOODLE_DB_CA_FILE.';
  if (error.code === 'ELOGIN') return 'O SQL Server recusou o login. Confira usuário, senha e acesso ao banco no seu computador.';
  if (['ESOCKET', 'ENOTOPEN', 'ETIMEOUT', 'ECONNREFUSED'].includes(error.code)) return 'Não foi possível acessar o SQL Server. Confira servidor, porta TCP e conexão à rede/VPN da Universidade.';
  if (error.code === 'EADDRINUSE') return 'As portas 3001 ou 8080 estão ocupadas. Encerre o teste anterior com Ctrl+C e execute novamente.';
  if (error.code === 'ENOENT') return 'Arquivo de configuração ou CA não encontrado. Confira os caminhos locais.';
  if (error.code === 'EACCES') return 'Sem permissão para ler um arquivo local ou abrir a porta do piloto.';
  if (error.code === 'EINVARIANT') return 'A coleta falhou na validação de consistência. O painel não foi aberto; revise os IDs e o mapeamento SQL com o NED/TI.';
  if (error.code === 'EREQUEST') return 'A consulta SQL falhou. Confira permissão de leitura nas tabelas Moodle e compatibilidade do esquema com a TI.' + (Number.isInteger(error.number) ? ' Código SQL: ' + error.number + '.' : '');
  if (error.code === 'MODULE_NOT_FOUND' || error.code === 'ERR_MODULE_NOT_FOUND') return 'Instale as dependências: npm ci e npm --prefix backend ci.';
  return 'Falha ao iniciar o piloto. Confira configuração, rede e compatibilidade do SQL com a TI. Credenciais não são exibidas no diagnóstico.';
}

module.exports = { APP_ORIGIN, LOOPBACK, PILOT_EMAIL, assertLocalPilotConfig, loadPilotEnvironment, pilotEnvironment, pilotRuntimeOptions, pilotErrorMessage };
