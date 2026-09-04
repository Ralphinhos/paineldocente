const crypto = require('node:crypto');
const { createRuntime } = require('../runtime');

async function main() {
  const runtime = await createRuntime();
  try {
    const audiences = process.env.REPORT_AUDIENCE === 'coordinators' ? ['coordinators'] : process.env.REPORT_AUDIENCE === 'executive' ? ['executive'] : ['coordinators', 'executive'];
    const actor = { id: 'system:weekly-report', name: 'Agendador semanal', email: 'system@localhost', role: 'ned_admin', courseIds: [] };
    const requestId = `scheduler-${crypto.randomUUID()}`;
    const results = [];
    for (const audience of audiences) results.push({ audience, ...(await runtime.services.reportService.send(audience, actor, requestId)) });
    process.stdout.write(`${JSON.stringify({ sent: true, results }, null, 2)}\n`);
  } finally {
    await runtime.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ sent: false, code: error.code || 'REPORT_FAILED', error: error.message })}\n`);
  process.exitCode = 1;
});
