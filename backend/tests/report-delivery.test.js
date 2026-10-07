const test = require('node:test');
const assert = require('node:assert/strict');
const nodemailer = require('nodemailer');
const { createRuntime } = require('../runtime');

test('Nodemailer compõe os relatórios separados por coordenação e a repetição não duplica envio', async () => {
  const runtime = await createRuntime({
    NODE_ENV: 'test', DATA_SOURCE: 'demo', SNAPSHOT_STORE: 'memory', AUTH_MODE: 'demo', EMAIL_SEND_ENABLED: 'false',
    SMTP_FROM: 'ned@example.invalid',
    REPORT_RECIPIENTS_JSON: JSON.stringify([
      { audience: 'coordinators', email: 'coord.alfa@example.invalid', name: 'Coordenação Alfa', courseIds: ['1101'] },
      { audience: 'coordinators', email: 'coord.beta@example.invalid', name: 'Coordenação Beta', courseIds: ['1102'] },
    ]),
  });
  // Stream transport composes MIME in memory. It never connects to SMTP or delivers a message.
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
  try {
    const { store, reportService } = runtime.services;
    const snapshot = await store.latestSnapshot();
    const publishableFixture = { ...snapshot, isDemo: false, publishAllowed: true, qualityStatus: 'VALID', qualityIssues: [] };
    store.latestSnapshot = async () => publishableFixture;
    const messages = [];
    reportService.transporter = {
      async sendMail(message) {
        const result = await transport.sendMail(message);
        messages.push({ envelope: result.envelope, mime: result.message.toString('utf8') });
        return result;
      },
    };
    const actor = { id: 'test:ned', name: 'NED de teste', role: 'ned_admin' };
    const first = await reportService.send('coordinators', actor, 'test:first', snapshot.id);
    assert.deepEqual(first.results.map(result => result.status), ['SENT', 'SENT']);
    assert.equal(messages.length, 2);
    for (const [index, address] of ['coord.alfa@example.invalid', 'coord.beta@example.invalid'].entries()) {
      assert.equal(messages[index].envelope.from, 'ned@example.invalid');
      assert.deepEqual(messages[index].envelope.to, [address]);
      assert.match(messages[index].mime, /Content-Type: text\/plain; charset=utf-8/);
      assert.match(messages[index].mime, /Content-Type: text\/html; charset=utf-8/);
      assert.ok(!messages[index].mime.includes('DD-SEM-40'));
    }
    assert.ok(messages[0].mime.includes('GP-EAD-40'));
    assert.ok(!messages[0].mime.includes('SI-MOD-40'));
    assert.ok(messages[1].mime.includes('SI-MOD-40'));
    assert.ok(!messages[1].mime.includes('GP-EAD-40'));

    const repeated = await reportService.send('coordinators', actor, 'test:repeat', snapshot.id);
    assert.deepEqual(repeated.results.map(result => result.status), ['ALREADY_SENT', 'ALREADY_SENT']);
    assert.equal(messages.length, 2);
    assert.ok(store.auditEvents.some(event => event.action === 'REPORT_SEND'));
  } finally {
    transport.close();
    await runtime.close();
  }
});
