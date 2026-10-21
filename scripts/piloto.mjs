import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
let runtime; let source; let server; let frontend; let stopped = false;

async function stop(code = 0) {
  if (stopped) return;
  stopped = true;
  let failed = false;
  try { await frontend?.close(); } catch { failed = true; }
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  try { await runtime?.close(); } catch { failed = true; }
  try { await source?.close(); } catch { failed = true; }
  process.exitCode = failed ? 1 : code;
}

process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());

async function main() {
  const { loadConfig } = require('../backend/config');
  const { loadPilotEnvironment, APP_ORIGIN, LOOPBACK } = require('../backend/core/pilot');
  const { MoodleSource } = require('../backend/data/moodleSource');
  const environment = loadPilotEnvironment(root); const config = loadConfig(environment);
  source = new MoodleSource(config.moodle);
  console.log('Testando conexão SQL Server com TLS e os IDs da amostra…');
  const connection = await source.testConnection();
  console.log(`Conexão OK. ${connection.courses} disciplina(s) encontrada(s).`);
  await source.close(); source = null;
  if (process.argv.includes('--connection-only')) return;
  if (stopped) return;

  const { createRuntime } = require('../backend/runtime');
  const { createApp } = require('../backend/app');
  const { validateSnapshot } = require('../backend/scripts/validate-snapshot');
  runtime = await createRuntime(environment);
  if (stopped) { await runtime.close(); runtime = null; return; }
  console.log('Coletando somente as disciplinas selecionadas…');
  const snapshot = await runtime.services.snapshotService.run();
  const errors = validateSnapshot(snapshot);
  if (errors.length) throw Object.assign(new Error('Invariantes inválidas.'), { code: 'EINVARIANT' });
  console.log(`Coleta real concluída: ${new Set(snapshot.rows.map((row) => row.course.id)).size} disciplina(s), ${new Set(snapshot.rows.map((row) => row.teacher.id)).size} docente(s). Consistência estrutural OK.`);
  console.log(`Situação de qualidade: ${snapshot.qualityStatus}. A validação automática não substitui a conferência com Moodle e planilhas.`);
  if (stopped) return;
  server = createApp(runtime).listen(3001, LOOPBACK);
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  if (stopped) return;
  const [{ createServer }, { pilotServerOptions, PILOT_NOTICE }] = await Promise.all([import('vite'), import('./pilot-server.mjs')]);
  if (stopped) return;
  frontend = await createServer(pilotServerOptions(root, config));
  if (stopped) { await frontend.close(); frontend = null; return; }
  await frontend.listen();
  if (stopped) return;
  console.log(`\nAbra ${APP_ORIGIN}/acompanhamento. A entrada local do NED é automática.`);
  console.log(PILOT_NOTICE);
  console.log('Use Prazos para cadastrar as datas, Entregas para UA/vídeos e Alta Gestão para o resumo.');
  console.log('Ctrl+C encerra o piloto. Esta configuração não serve para publicar no servidor.\n');
}

main().catch(async (error) => {
  try { const { pilotErrorMessage } = require('../backend/core/pilot'); console.error(pilotErrorMessage(error)); }
  catch { console.error('Instale as dependências: npm ci e npm --prefix backend ci.'); }
  await stop(1);
});
