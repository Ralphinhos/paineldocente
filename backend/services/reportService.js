const crypto = require('node:crypto');
const nodemailer = require('nodemailer');
const { HttpError } = require('../core/http');
const { createReportRun } = require('./store');
function escapeHtml(value) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }
function dateTime(value) { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(value)); }
function reportTitle(audience) { return audience === 'executive' ? 'Resumo executivo — acompanhamento docente' : 'Acompanhamento docente — pendências e acessos'; }
function buildReport(audience, dashboard, recipientName = 'Responsável') {
  const { meta, summary } = dashboard; const exceptions = dashboard.rows.filter((row) => row.severity !== 'OK');
  const totals = [`${summary.courses} disciplinas monitoradas`, `${summary.monitoredTeachers} docentes`, `${summary.requirements.overdue} entregas aplicáveis vencidas`, `${summary.access.critical + summary.access.never} acessos críticos`, `${summary.requirements.notVerifiable} dados não verificáveis`, `${summary.requirements.notApplicable} itens não aplicáveis`];
  const subject = `${reportTitle(audience)} | ${new Intl.DateTimeFormat('pt-BR').format(new Date(meta.generatedAt))}`;
  const details = exceptions.slice(0, audience === 'executive' ? 5 : 30).map((row) => ({ course: row.course.shortName, teacher: row.teacher.name, reason: row.primaryReason }));
  const blocker = meta.publishAllowed ? null : 'ENVIO BLOQUEADO: regras ou qualidade dos dados ainda não foram homologadas.';
  const text = [`Prezado(a) ${recipientName},`, '', reportTitle(audience), `Base gerada em ${dateTime(meta.generatedAt)}. Snapshot imutável: ${meta.snapshotId}.`, `Regra: ${meta.rulesVersion} (${meta.rulesStatus}).`, '', ...totals.map((item) => `- ${item}`), '', blocker || 'Dados validados para publicação.', '', ...(details.length ? ['Pontos que exigem atenção:', ...details.map((item) => `- ${item.course} — ${item.teacher}: ${item.reason}`)] : ['Nenhuma exceção identificada.']), '', 'Estrutura e acesso são avaliados separadamente. Conclusão ou visualização não comprovam entrega.'].join('\n');
  const rows = details.map((item) => `<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0">${escapeHtml(item.course)}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${escapeHtml(item.teacher)}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${escapeHtml(item.reason)}</td></tr>`).join('');
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#172033"><main style="max-width:760px;margin:24px auto;background:white"><header style="background:#071d35;color:white;padding:24px"><p style="color:#67e8f9">UNIFENAS · NED</p><h1>${escapeHtml(reportTitle(audience))}</h1></header><section style="padding:24px"><p>Prezado(a) ${escapeHtml(recipientName)},</p><p>Base: <strong>${escapeHtml(dateTime(meta.generatedAt))}</strong>. Regra ${escapeHtml(meta.rulesVersion)}.</p><ul>${totals.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>${blocker ? `<p style="padding:12px;background:#fef2f2;color:#991b1b"><strong>${escapeHtml(blocker)}</strong></p>` : ''}${rows ? `<table style="width:100%;border-collapse:collapse"><tbody>${rows}</tbody></table>` : '<p>Nenhuma exceção.</p>'}<p style="color:#475569;font-size:13px">Estrutura e acesso são independentes. Conclusão ou visualização não comprovam entrega.</p></section></main></body></html>`;
  return { subject, text, html, totals, details, blocker };
}
function recipientUser(audience, recipient) { return { id: `report:${recipient.email}`, email: recipient.email, name: recipient.name, role: audience === 'coordinators' ? 'coordinator' : 'executive', courseIds: recipient.courseIds || [] }; }
class ReportService {
  constructor({ config, store, dashboardService }) { this.config = config; this.store = store; this.dashboardService = dashboardService; this.transporter = config.reports.emailEnabled ? nodemailer.createTransport({ host: config.reports.smtp.host, port: config.reports.smtp.port, secure: config.reports.smtp.secure, auth: config.reports.smtp.user ? { user: config.reports.smtp.user, pass: config.reports.smtp.password } : undefined }) : null; }
  async preview(audience, user) {
    if (user.role === 'coordinator' || user.role === 'executive') return [{ recipient: { name: user.name, email: user.email }, ...buildReport(audience, await this.dashboardService.getDashboard(user, { pageSize: 50 }), user.name) }];
    const recipients = this.config.reports.recipients.filter((item) => item.audience === audience);
    if (recipients.length) return Promise.all(recipients.map(async (recipient) => ({ recipient: { name: recipient.name, email: recipient.email }, ...buildReport(audience, await this.dashboardService.getDashboard(recipientUser(audience, recipient), { pageSize: 50 }), recipient.name) })));
    const previewUser = { ...user, role: audience === 'executive' ? 'executive' : 'ned_admin', courseIds: [] };
    return [{ recipient: null, ...buildReport(audience, await this.dashboardService.getDashboard(previewUser, { pageSize: 50 }), 'Responsável (prévia sem destinatário)') }];
  }
  async send(audience, actor, requestId) {
    const snapshot = await this.store.latestSnapshot(); if (!snapshot) throw new HttpError(503, 'SNAPSHOT_UNAVAILABLE', 'Ainda não há coleta disponível.'); if (snapshot.isDemo) throw new HttpError(409, 'DEMO_SEND_BLOCKED', 'Envio externo é proibido com dados demonstrativos.'); if (!snapshot.publishAllowed) throw new HttpError(409, 'QUALITY_GATE_BLOCKED', 'A qualidade ou as regras bloquearam a publicação.'); if (!this.transporter) throw new HttpError(409, 'EMAIL_DISABLED', 'Envio de e-mail não está habilitado.');
    const recipients = this.config.reports.recipients.filter((item) => item.audience === audience); if (!recipients.length) throw new HttpError(409, 'RECIPIENTS_MISSING', 'Nenhum destinatário configurado no servidor.'); const results = [];
    for (const recipient of recipients) {
      const key = crypto.createHash('sha256').update(`${snapshot.id}:${audience}:${recipient.email.toLowerCase()}`).digest('hex');
      const existing = await this.store.findReportRun(key);
      if (existing?.status === 'SENT' || existing?.status === 'PROCESSING') { results.push({ email: recipient.email, status: existing.status === 'SENT' ? 'ALREADY_SENT' : 'IN_PROGRESS' }); continue; }
      const run = existing || createReportRun({ snapshotId: snapshot.id, audience, idempotencyKey: key, recipients: [recipient.email], status: 'PROCESSING' });
      if (existing) await this.store.updateReportRun(run.id, { status: 'PROCESSING', errorMessage: null, sentAt: null }); else await this.store.recordReportRun(run);
      try {
        const report = buildReport(audience, await this.dashboardService.getDashboard(recipientUser(audience, recipient), { pageSize: 50 }), recipient.name);
        await this.transporter.sendMail({ from: this.config.reports.smtp.from, to: recipient.email, subject: report.subject, text: report.text, html: report.html });
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
