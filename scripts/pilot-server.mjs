import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { APP_ORIGIN, LOOPBACK, PILOT_EMAIL, assertLocalPilotConfig } = require('../backend/core/pilot');
export const PILOT_NOTICE = 'PILOTO LOCAL · dados reais em validação · e-mails desligados · prazos e registros manuais são temporários e se perdem ao encerrar.';

export function pilotNotice(options = {}) {
  return PILOT_NOTICE + (options.trustServerCertificate === true ? ' TLS ativo; identidade do servidor SQL não verificada.' : '')
    + (options.includeHiddenCourses === true ? ' Amostra permite disciplinas ocultas selecionadas.' : '');
}

export function pilotServerOptions(root, config, localPilotOptions = {}) {
  assertLocalPilotConfig(config);
  return {
    root, configFile: path.join(root, 'vite.config.ts'),
    server: {
      host: LOOPBACK, port: 8080, strictPort: true, open: false,
      proxy: { '/api': {
        target: 'http://127.0.0.1:3001', changeOrigin: true,
        configure(proxy) { proxy.on('proxyReq', (request) => { request.setHeader('x-panel-auth-secret', config.auth.proxySharedSecret); request.setHeader('x-auth-request-email', PILOT_EMAIL); }); },
      } },
    },
    plugins: [{ name: 'pilot-local-notice', transformIndexHtml() { return [{ tag: 'div', attrs: { role: 'note', style: 'padding:10px 16px;background:#fff5df;color:#624300;font:13px/1.5 system-ui;text-align:center' }, children: pilotNotice(localPilotOptions), injectTo: 'body-prepend' }]; } }],
  };
}

export { APP_ORIGIN, LOOPBACK };
