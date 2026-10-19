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

test('prévia e envio selecionado preservam Cc, escopo e somente o destinatário conferido', async () => {
  const runtime = await createRuntime({
    NODE_ENV: 'test', DATA_SOURCE: 'demo', AUTH_MODE: 'demo', SMTP_FROM: 'ned@example.invalid',
    REPORT_RECIPIENTS_JSON: JSON.stringify([
      { audience: 'coordinators', email: 'alfa@example.invalid', name: 'Alfa', courseIds: ['1101'], cc: ['reitoria@example.invalid', 'proreitoria@example.invalid', 'diretoria@example.invalid'] },
      { audience: 'coordinators', email: 'beta@example.invalid', name: 'Beta', courseIds: ['1102'] },
    ]),
  });
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
  try {
    const { store, reportService } = runtime.services;
    const snapshot = await store.latestSnapshot();
    store.latestSnapshot = async () => ({ ...snapshot, isDemo: false, publishAllowed: true, qualityStatus: 'VALID', qualityIssues: [] });
    const previews = await reportService.preview('coordinators', { role: 'ned_admin' });
    assert.deepEqual(previews[0].recipient.cc, ['reitoria@example.invalid', 'proreitoria@example.invalid', 'diretoria@example.invalid']);
    assert.ok(!previews[0].text.includes('SI-MOD-40'));
    assert.ok(!previews[0].text.includes('Ranking'));
    assert.ok(!previews[1].text.includes('Sem acessar o ambiente há 16'));
    const messages = [];
    reportService.transporter = { async sendMail(message) { messages.push(await transport.sendMail(message)); } };
    const actor = { id: 'test:ned', role: 'ned_admin' };
    await reportService.send('coordinators', actor, 'selected', snapshot.id, ['alfa@example.invalid']);
    assert.equal(messages.length, 1);
    assert.deepEqual(messages[0].envelope.to, ['alfa@example.invalid', 'reitoria@example.invalid', 'proreitoria@example.invalid', 'diretoria@example.invalid']);
    assert.ok(messages[0].message.toString().includes('Cc:'));
    assert.equal(store.reportRuns.length, 1);
    await assert.rejects(reportService.send('coordinators', actor, 'unknown', snapshot.id, ['intruso@example.invalid']), (error) => error.code === 'RECIPIENT_NOT_CONFIGURED');
    assert.equal(messages.length, 1);
    const repeat = await reportService.send('coordinators', actor, 'repeat', snapshot.id, ['alfa@example.invalid']);
    assert.equal(repeat.results[0].status, 'ALREADY_SENT'); assert.equal(messages.length, 1);
  } finally { transport.close(); await runtime.close(); }
});

test('envio bloqueia coleta desatualizada mesmo se o snapshot estava liberado', async () => {
  const runtime = await createRuntime({ NODE_ENV: 'test', DATA_SOURCE: 'demo', AUTH_MODE: 'demo', REPORT_RECIPIENTS_JSON: JSON.stringify([{ audience: 'coordinators', email: 'alfa@example.invalid', name: 'Alfa', courseIds: ['1101'] }]) });
  try {
    const { store, reportService } = runtime.services; const snapshot = await store.latestSnapshot();
    store.latestSnapshot = async () => ({ ...snapshot, generatedAt: '2000-01-01T12:00:00Z', isDemo: false, publishAllowed: true });
    let sent = false; reportService.transporter = { async sendMail() { sent = true; } };
    await assert.rejects(reportService.send('coordinators', { id: 'ned' }, 'stale', snapshot.id), (error) => error.code === 'QUALITY_GATE_BLOCKED');
    assert.equal(sent, false);
  } finally { await runtime.close(); }
});
