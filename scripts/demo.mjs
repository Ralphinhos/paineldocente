import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import path from 'node:path';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
let runtime; let server; let frontend; let stopping = false;

async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  frontend?.kill();
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  await runtime?.close();
  process.exitCode = code;
}

process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());

async function main() {
  const { createRuntime } = require('../backend/runtime.js');
  const { createApp } = require('../backend/app.js');
  runtime = await createRuntime({
    ...process.env, NODE_ENV: 'development', PORT: '3001', APP_ORIGIN: 'http://localhost:8080',
    AUTH_MODE: 'demo', DEMO_AUTH_ENABLED: 'true', COOKIE_SECURE: 'false', TRUST_PROXY: 'false',
    JWT_SECRET: randomBytes(48).toString('base64url'), AUTH_USERS_JSON: '[]',
    DATA_SOURCE: 'demo', SNAPSHOT_STORE: 'memory', RULES_APPROVED: 'false',
    RULE_CATALOG_PATH: path.join(root, 'backend/config/rules.json'),
    EMAIL_SEND_ENABLED: 'false', REPORT_RECIPIENTS_JSON: '[]',
  });
  server = createApp(runtime).listen(3001, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  console.log('\nVisual 2.0 · teste com dados fictícios · e-mails desabilitados.');
  console.log('Abra http://localhost:8080 e escolha Equipe NED ou Alta gestão.');
  console.log('Para encerrar os dois serviços: Ctrl+C.\n');
  frontend = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', 'localhost', '--port', '8080', '--strictPort'], { cwd: root, stdio: 'inherit', env: { ...process.env, NODE_ENV: 'development' } });
  frontend.once('error', (error) => { console.error(error.message); void stop(1); });
  frontend.once('exit', (code) => void stop(code ?? 0));
}

main().catch(async (error) => {
  console.error(error.code === 'EADDRINUSE' ? 'A porta 3001 já está em uso. Encerre o teste anterior com Ctrl+C e rode npm run demo novamente.' : error.code === 'MODULE_NOT_FOUND' ? 'Instale as dependências: npm ci e npm --prefix backend ci.' : error.message);
  await stop(1);
});
