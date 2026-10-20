const crypto = require('node:crypto');
const nodemailer = require('nodemailer');
const { HttpError } = require('../core/http');
const { createReportRun } = require('./store');
const { buildReport } = require('./occurrenceReport');
const { MonitoringService } = require('./monitoringService');
function recipientUser(audience, recipient) { return { id: `report:${recipient.email}`, email: recipient.email, name: recipient.name, role: audience === 'coordinators' ? 'coordinator' : 'executive', courseIds: recipient.courseIds || [] }; }
class ReportService {
  constructor({ config, store, monitoringService }) { this.config = config; this.store = store; this.monitoringService = monitoringService || new MonitoringService({ store, snapshotIntervalMinutes: config.snapshotIntervalMinutes || 1440 }); this.transporter = config.reports.emailEnabled ? nodemailer.createTransport({ host: config.reports.smtp.host, port: config.reports.smtp.port, secure: config.reports.smtp.secure, auth: config.reports.smtp.user ? { user: config.reports.smtp.user, pass: config.reports.smtp.password } : undefined }) : null; }
  async preview(audience, user) {
    const snapshot = await this.store.latestSnapshot();
    if (!snapshot) throw new HttpError(503, 'SNAPSHOT_UNAVAILABLE', 'Ainda não há coleta disponível.');
    if (user.role === 'coordinator' || user.role === 'executive') return [{ recipient: { name: user.name, email: user.email }, ...buildReport(audience, await this.monitoringService.getMonitoring(user, {}, { snapshot, allRows: true }), user.name) }];
    const recipients = this.config.reports.recipients.filter((item) => item.audience === audience);
    if (recipients.length) return Promise.all(recipients.map(async (recipient) => ({ recipient: { name: recipient.name, email: recipient.email, cc: recipient.cc || [] }, ...buildReport(audience, await this.monitoringService.getMonitoring(recipientUser(audience, recipient), {}, { snapshot, allRows: true }), recipient.name) })));
    const previewUser = { ...user, role: audience === 'executive' ? 'executive' : 'ned_admin', courseIds: [] };
    return [{ recipient: null, ...buildReport(audience, await this.monitoringService.getMonitoring(previewUser, {}, { snapshot, allRows: true }), 'Responsável (prévia sem destinatário)') }];
  }
  async send(audience, actor, requestId, expectedSnapshotId, recipientEmails) {
    const snapshot = await this.store.latestSnapshot(); if (!snapshot) throw new HttpError(503, 'SNAPSHOT_UNAVAILABLE', 'Ainda não há coleta disponível.'); if (expectedSnapshotId && expectedSnapshotId !== snapshot.id) throw new HttpError(409, 'STALE_REPORT', 'Os dados mudaram. Abra uma nova prévia antes do envio.'); if (snapshot.isDemo) throw new HttpError(409, 'DEMO_SEND_BLOCKED', 'Envio externo é proibido com dados demonstrativos.'); if (!snapshot.publishAllowed) throw new HttpError(409, 'QUALITY_GATE_BLOCKED', 'A qualidade ou as regras bloquearam a publicação.'); if (!this.transporter) throw new HttpError(409, 'EMAIL_DISABLED', 'Envio de e-mail não está habilitado.');
    const configured = this.config.reports.recipients.filter((item) => item.audience === audience);
    const selected = recipientEmails && new Set(recipientEmails.map((email) => email.toLowerCase()));
    if (selected && [...selected].some((email) => !configured.some((item) => item.email.toLowerCase() === email))) throw new HttpError(400, 'RECIPIENT_NOT_CONFIGURED', 'Destinatário fora da configuração do NED.');
    const recipients = configured.filter((item) => !selected || selected.has(item.email.toLowerCase())); if (!recipients.length) throw new HttpError(409, 'RECIPIENTS_MISSING', 'Nenhum destinatário configurado no servidor.'); const results = [];
    const reports = await Promise.all(recipients.map((recipient) => this.monitoringService.getMonitoring(recipientUser(audience, recipient), {}, { snapshot, allRows: true }).then((data) => buildReport(audience, data, recipient.name))));
    if (reports.some((report) => !report.publishAllowed)) throw new HttpError(409, 'QUALITY_GATE_BLOCKED', 'Atualize ou valide os dados antes do envio.');
    for (const [index, recipient] of recipients.entries()) {
      const key = crypto.createHash('sha256').update(`${snapshot.id}:${audience}:${recipient.email.toLowerCase()}`).digest('hex');
      const claim = await this.store.claimReportRun(createReportRun({ snapshotId: snapshot.id, audience, idempotencyKey: key, recipients: [recipient.email, ...(recipient.cc || [])], status: 'PROCESSING' }));
      if (!claim.claimed) { results.push({ email: recipient.email, status: claim.run?.status === 'SENT' ? 'ALREADY_SENT' : 'IN_PROGRESS' }); continue; }
      const run = claim.run;
      try {
        const report = reports[index];
        await this.transporter.sendMail({ from: this.config.reports.smtp.from, to: recipient.email, cc: recipient.cc || [], subject: report.subject, text: report.text, html: report.html });
        await this.store.updateReportRun(run.id, { status: 'SENT', sentAt: new Date().toISOString() }); results.push({ email: recipient.email, status: 'SENT' });
      } catch (error) {
        await this.store.updateReportRun(run.id, { status: 'FAILED', errorMessage: error.message });
        throw new HttpError(502, 'EMAIL_DELIVERY_FAILED', 'O provedor de e-mail recusou o envio.');
      }
    }
    await this.store.addAudit({ actorId: actor.id, action: 'REPORT_SEND', targetId: snapshot.id, requestId, metadata: { audience, count: results.length } }); return { snapshotId: snapshot.id, results };
  }
}
module.exports = { ReportService, buildReport };
