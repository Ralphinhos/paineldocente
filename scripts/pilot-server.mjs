import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { APP_ORIGIN, LOOPBACK, PILOT_EMAIL } = require('../backend/core/pilot');
export const PILOT_NOTICE = 'PILOTO LOCAL · dados reais em validação · e-mails desligados · prazos e registros manuais são temporários e se perdem ao encerrar.';

export function pilotServerOptions(root, config) {
  if (config.production || config.dataSource !== 'moodle' || config.snapshotStore !== 'memory' || config.auth.mode !== 'proxy'
    || config.auth.demoEnabled || config.reports.emailEnabled || config.rules.approved || !config.moodle.courseIds.length) throw new Error('Configuração incompatível com o piloto local.');
  return {
    root, configFile: path.join(root, 'vite.config.ts'),
    server: {
      host: LOOPBACK, port: 8080, strictPort: true, open: false,
      proxy: { '/api': {
        target: 'http://127.0.0.1:3001', changeOrigin: true,
        configure(proxy) { proxy.on('proxyReq', (request) => { request.setHeader('x-panel-auth-secret', config.auth.proxySharedSecret); request.setHeader('x-auth-request-email', PILOT_EMAIL); }); },
      } },
    },
    plugins: [{ name: 'pilot-local-notice', transformIndexHtml() { return [{ tag: 'div', attrs: { role: 'note', style: 'padding:10px 16px;background:#fff5df;color:#624300;font:13px/1.5 system-ui;text-align:center' }, children: PILOT_NOTICE, injectTo: 'body-prepend' }]; } }],
  };
}

export { APP_ORIGIN, LOOPBACK };
