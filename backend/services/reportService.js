const crypto = require('node:crypto');
const nodemailer = require('nodemailer');
const { HttpError } = require('../core/http');
const { createReportRun } = require('./store');
const { delayLabel } = require('../core/timing');
function escapeHtml(value) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }
function dateTime(value) { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(value)); }
function reportTitle(audience) { return audience === 'executive' ? 'Resumo executivo — acompanhamento docente' : 'Acompanhamento docente — pendências e acessos'; }
function rankingHtml(ranking) {
  if (!ranking?.policy) return '<p>Ranking indisponível nesta versão das regras.</p>';
  const priority = ranking.priority.slice(0, 5);
  const rows = priority.map((entry) => `<tr><td>${escapeHtml(entry.teacher.name)}</td><td><strong>${escapeHtml(entry.score)}/100</strong></td><td>${entry.overdue} vencidas · maior atraso ${entry.maxDaysLate} dias · ${entry.accessCritical} acessos críticos</td></tr>`).join('');
  const regularity = ranking.regularity.slice(0, 5).map((entry) => `${escapeHtml(entry.teacher.name)} (${escapeHtml(entry.score)})`).join(' · ');
  const accessOnly = ranking.access.filter((entry) => entry.mode === 'ACCESS_ONLY').slice(0, 5);
  return `<p>Prazo <b>50</b> · Duração do atraso <b>20</b> · Acesso <b>30</b></p><h3>Prioridade de acompanhamento</h3>${rows ? `<table><thead><tr><th>Docente</th><th>Nota</th><th>Acompanhamento</th></tr></thead><tbody>${rows}</tbody></table>` : '<p>Sem docentes com nota geral que exijam acompanhamento.</p>'}${regularity ? `<p><b>Melhor regularidade:</b> ${regularity}.</p>` : ''}${accessOnly.length ? `<p><b>Somente acesso (escala própria):</b> ${accessOnly.map((entry) => `${escapeHtml(entry.teacher.name)} (${entry.accessScore}/100; ${entry.accessCritical} acessos críticos)`).join(' · ')}.</p>` : ''}${ranking.needsValidation ? `<p>${ranking.needsValidation} docentes fora da nota geral: base incompleta.</p>` : ''}`;
}
function buildReport(audience, dashboard, recipientName = 'Responsável') {
  const { meta, summary, ranking } = dashboard;
  const executive = audience === 'executive';
  const exceptions = dashboard.rows.filter((row) => row.severity !== 'OK');
  const selected = executive ? exceptions.slice(0, 5) : dashboard.rows.filter((row) => row.severity !== 'OK' || row.requirements.some((item) => item.status === 'DELIVERED_LATE' && item.responsibility !== 'OTHER_TEACHER'));
  const totals = [`${summary.courses} disciplinas · ${summary.monitoredTeachers} docentes`, `${summary.requirements.overdue} entregas vencidas`, `${summary.access.critical + summary.access.never} acessos críticos`, `Atraso médio das entregas concluídas: ${summary.averageDaysLate ?? '—'} dias (${summary.measuredLateItems} entregas com duração comprovada)`];
  if (summary.unmeasuredLateItems) totals.push(`${summary.unmeasuredLateItems} atrasos com duração a validar`);
  const subject = `${reportTitle(audience)} | ${dateTime(meta.generatedAt).split(',')[0]}`;
  const details = selected.map((row) => ({ course: row.course.shortName, teacher: row.teacher.name, reason: executive ? row.primaryReason : [row.accessStatus === 'OUTSIDE_WINDOW' ? 'Acesso fora do período ativo' : row.lastAccessAt ? `Acesso há ${row.daysSinceAccess} dias` : 'Sem acesso registrado', ...row.requirements.filter((item) => item.responsibility !== 'OTHER_TEACHER' && (item.status === 'PENDING' && item.overdue || item.status === 'DELIVERED_LATE')).map((item) => `${item.label}: ${delayLabel(item)}${item.responsibility === 'UNCONFIRMED' ? ' (responsável a definir)' : ''}`)].join(' · ') }));
  const blocker = meta.publishAllowed ? null : 'ENVIO BLOQUEADO: dados ou regras aguardam validação.';
  const rankingLines = [];
  if (ranking?.policy) {
    rankingLines.push('Ranking 50/20/30: prazo / duração do atraso / acesso.');
    for (const [label, items] of [['Melhor regularidade', ranking.regularity], ['Prioridade de acompanhamento', ranking.priority]]) {
      rankingLines.push(`${label}:`, ...items.slice(0, 5).map((entry) => `${entry.teacher.name}: ${entry.score}/100 · ${entry.overdue} pendências vencidas · maior atraso ${entry.maxDaysLate} dias`));
      if (!items.length) rankingLines.push('Sem docentes com base comparável.');
    }
    const accessOnly = ranking.access.filter((entry) => entry.mode === 'ACCESS_ONLY');
    if (accessOnly.length) rankingLines.push('Somente acesso:', ...accessOnly.slice(0, 5).map((entry) => `${entry.teacher.name}: ${entry.accessScore}/100 · ${entry.accessCritical} disciplinas com acesso crítico`));
    if (ranking.needsValidation) rankingLines.push(`${ranking.needsValidation} docentes fora da classificação geral: base incompleta.`);
  } else rankingLines.push('Ranking indisponível nesta versão das regras.');
  const rest = executive && exceptions.length > details.length ? `${exceptions.length - details.length} outras ocorrências disponíveis no painel.` : null;
  const text = [`Prezado(a) ${recipientName},`, '', reportTitle(audience), `Dados de ${dateTime(meta.generatedAt)}.`, '', ...totals, '', ...rankingLines, '', ...(details.length ? ['Acompanhamento:', ...details.map((item) => `${item.course} — ${item.teacher}: ${item.reason}`)] : ['Nenhuma ocorrência identificada.']), rest, '', blocker, `Referência: ${meta.snapshotId} · Regra ${meta.rulesVersion}`].filter((value) => value !== null).join('\n');
  const rows = details.map((item) => `<tr><td>${escapeHtml(item.course)}</td><td>${escapeHtml(item.teacher)}</td><td>${escapeHtml(item.reason)}</td></tr>`).join('');
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title><style>body{margin:0;background:#f4f7fa;color:#172e43;font:15px/1.5 Arial,sans-serif}main{max-width:880px;margin:24px auto;background:white;padding:28px}h1{font-size:24px}h2{font-size:18px;margin-top:28px}h3{font-size:15px}td{overflow-wrap:anywhere}@media(max-width:600px){main{padding:16px;margin:0}th,td{padding:8px 5px;font-size:13px}}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:12px 8px;border-bottom:1px solid #dce5ec;vertical-align:top}footer{font-size:12px;color:#4b6375;margin-top:24px}.blocked{color:#a32118}li{margin-bottom:8px}@media print{main{margin:0;padding:0}body{background:white}}</style></head><body><main><p>UNIFENAS · NED</p><h1>${escapeHtml(reportTitle(audience))}</h1><p>Prezado(a) ${escapeHtml(recipientName)},</p><p>Dados de <strong>${escapeHtml(dateTime(meta.generatedAt))}</strong>.</p><ul>${totals.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul><h2>Regularidade docente</h2>${rankingHtml(ranking)}<h2>Acompanhamento</h2>${rows ? `<table><thead><tr><th>Disciplina</th><th>Docente</th><th>Situação</th></tr></thead><tbody>${rows}</tbody></table>` : '<p>Nenhuma ocorrência.</p>'}${rest ? `<p>${escapeHtml(rest)}</p>` : ''}${blocker ? `<p class="blocked">${escapeHtml(blocker)}</p>` : ''}<footer>Referência ${escapeHtml(meta.snapshotId)} · Regra ${escapeHtml(meta.rulesVersion)}. Nota administrativa de acompanhamento; bases incompletas ficam fora da classificação geral.</footer></main></body></html>`;
  return { snapshotId: meta.snapshotId, publishAllowed: meta.publishAllowed, subject, text, html, totals, details, blocker };
}
function recipientUser(audience, recipient) { return { id: `report:${recipient.email}`, email: recipient.email, name: recipient.name, role: audience === 'coordinators' ? 'coordinator' : 'executive', courseIds: recipient.courseIds || [] }; }
class ReportService {
  constructor({ config, store, dashboardService }) { this.config = config; this.store = store; this.dashboardService = dashboardService; this.transporter = config.reports.emailEnabled ? nodemailer.createTransport({ host: config.reports.smtp.host, port: config.reports.smtp.port, secure: config.reports.smtp.secure, auth: config.reports.smtp.user ? { user: config.reports.smtp.user, pass: config.reports.smtp.password } : undefined }) : null; }
  async preview(audience, user) {
    const snapshot = await this.store.latestSnapshot();
    if (!snapshot) throw new HttpError(503, 'SNAPSHOT_UNAVAILABLE', 'Ainda não há coleta disponível.');
    if (user.role === 'coordinator' || user.role === 'executive') return [{ recipient: { name: user.name, email: user.email }, ...buildReport(audience, await this.dashboardService.getDashboard(user, {}, { snapshot, allRows: true }), user.name) }];
    const recipients = this.config.reports.recipients.filter((item) => item.audience === audience);
    if (recipients.length) return Promise.all(recipients.map(async (recipient) => ({ recipient: { name: recipient.name, email: recipient.email }, ...buildReport(audience, await this.dashboardService.getDashboard(recipientUser(audience, recipient), {}, { snapshot, allRows: true }), recipient.name) })));
    const previewUser = { ...user, role: audience === 'executive' ? 'executive' : 'ned_admin', courseIds: [] };
    return [{ recipient: null, ...buildReport(audience, await this.dashboardService.getDashboard(previewUser, {}, { snapshot, allRows: true }), 'Responsável (prévia sem destinatário)') }];
  }
  async send(audience, actor, requestId, expectedSnapshotId) {
    const snapshot = await this.store.latestSnapshot(); if (!snapshot) throw new HttpError(503, 'SNAPSHOT_UNAVAILABLE', 'Ainda não há coleta disponível.'); if (expectedSnapshotId && expectedSnapshotId !== snapshot.id) throw new HttpError(409, 'STALE_REPORT', 'Os dados mudaram. Abra uma nova prévia antes do envio.'); if (snapshot.isDemo) throw new HttpError(409, 'DEMO_SEND_BLOCKED', 'Envio externo é proibido com dados demonstrativos.'); if (!snapshot.publishAllowed) throw new HttpError(409, 'QUALITY_GATE_BLOCKED', 'A qualidade ou as regras bloquearam a publicação.'); if (!this.transporter) throw new HttpError(409, 'EMAIL_DISABLED', 'Envio de e-mail não está habilitado.');
    const recipients = this.config.reports.recipients.filter((item) => item.audience === audience); if (!recipients.length) throw new HttpError(409, 'RECIPIENTS_MISSING', 'Nenhum destinatário configurado no servidor.'); const results = [];
    for (const recipient of recipients) {
      const key = crypto.createHash('sha256').update(`${snapshot.id}:${audience}:${recipient.email.toLowerCase()}`).digest('hex');
      const existing = await this.store.findReportRun(key);
      if (existing?.status === 'SENT' || existing?.status === 'PROCESSING') { results.push({ email: recipient.email, status: existing.status === 'SENT' ? 'ALREADY_SENT' : 'IN_PROGRESS' }); continue; }
      const run = existing || createReportRun({ snapshotId: snapshot.id, audience, idempotencyKey: key, recipients: [recipient.email], status: 'PROCESSING' });
      if (existing) await this.store.updateReportRun(run.id, { status: 'PROCESSING', errorMessage: null, sentAt: null }); else await this.store.recordReportRun(run);
      try {
        const report = buildReport(audience, await this.dashboardService.getDashboard(recipientUser(audience, recipient), {}, { snapshot, allRows: true }), recipient.name);
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
