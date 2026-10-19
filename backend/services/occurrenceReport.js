const { delayLabel } = require('../core/timing');
const escapeHtml = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const dateTime = (value) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(value));

function buildReport(_audience, data, recipientName = 'Responsável') {
  const { meta, access, deliveries } = data;
  const a = access.summary; const d = deliveries.summary;
  const scope = data.filters.courses.map((course) => course.label).join('; ') || 'Nenhuma disciplina vinculada';
  const details = [
    ...access.rows.filter((row) => ['ATTENTION', 'CRITICAL', 'NEVER'].includes(row.status)).map((row) => ({
      teacher: row.teacher.name,
      course: row.courses.map((course) => course.shortName).join(' · '),
      reason: row.status === 'NEVER' ? 'Sem acesso registrado ao ambiente' : `Sem acessar o ambiente há ${row.daysSinceAccess} dias · ${row.status === 'ATTENTION' ? 'atenção' : 'crítico'}`,
    })),
    ...deliveries.rows.filter((row) => row.displayStatus === 'OVERDUE').map((row) => ({
      teacher: row.teacher.name, course: row.course.shortName,
      reason: `${row.item.label}: ${delayLabel(row.item)}`,
    })),
  ];
  const validations = [
    ...access.rows.filter((row) => row.status === 'NOT_VERIFIABLE').map((row) => `${row.teacher.name}: acesso ao ambiente a validar`),
    ...deliveries.rows.filter((row) => row.displayStatus === 'NOT_VERIFIABLE').map((row) => `${row.course.shortName} · ${row.item.label}: ${row.item.reason}`),
  ];
  const totals = [
    `Acessos ao ambiente: ${a.current} em dia · ${a.attention} em atenção · ${a.critical} críticos · ${a.never} sem registro.`,
    `Entregas: ${d.overdue} pendências vencidas · ${d.pendingInTime} pendências dentro do prazo.`,
    `${d.early + d.onTime + d.inherited} entregas antecipadas, no prazo ou replicadas e conferidas.`,
    `${d.deliveredLate} entregas com atraso já resolvidas; ${d.notApplicable} itens não aplicáveis.`,
    `${a.validation} acessos e ${d.validation} entregas a validar.`,
  ];
  const publishAllowed = Boolean(meta.publishAllowed && !meta.stale && !validations.length && data.filters.courses.length);
  const blocker = publishAllowed ? null : meta.stale ? 'ENVIO BLOQUEADO: atualize a coleta antes de encaminhar.' : 'ENVIO BLOQUEADO: dados ou regras aguardam validação.';
  const subject = `Acompanhamento docente — ocorrências | ${dateTime(meta.generatedAt).split(',')[0]}`;
  const regular = validations.length || meta.qualityStatus === 'BLOCKED' || !data.filters.courses.length
    ? 'Esta coleta ainda aguarda validação do NED antes da conclusão e do envio.'
    : 'Os demais itens verificados não apresentam pendências vencidas nesta coleta. Itens ainda no prazo continuam em acompanhamento.';
  const text = [
    `Prezado(a) ${recipientName},`, '',
    'Encaminhamos o acompanhamento docente dos cursos sob sua coordenação.',
    `Relatório gerado em ${dateTime(meta.generatedAt)}. Pode haver alterações após essa data.`,
    `Disciplinas abrangidas: ${scope}.`, '', ...totals, '',
    ...(details.length ? ['Ocorrências para acompanhamento:', ...details.map((item) => `${item.teacher} — ${item.course}: ${item.reason}`)] : ['Nenhuma ocorrência confirmada para cobrança nesta coleta.']),
    '', regular,
    ...(validations.length ? ['', 'Revisão pelo NED:', ...validations] : []),
    '', 'Ficamos à disposição para esclarecimentos.', '', 'Atenciosamente,', 'NED — UNIFENAS', '',
    blocker, `Referência: ${meta.snapshotId} · Regras ${meta.rulesVersion}`,
  ].filter((value) => value !== null).join('\n');
  const htmlRows = details.map((item) => `<tr><td>${escapeHtml(item.teacher)}</td><td>${escapeHtml(item.course)}</td><td>${escapeHtml(item.reason)}</td></tr>`).join('');
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title><style>body{font:15px/1.55 Arial,sans-serif;color:#1e293b;background:#f8fafc;margin:0}main{max-width:880px;margin:24px auto;background:#fff;padding:28px}h1{font-size:24px}h2{font-size:18px}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:10px;border-bottom:1px solid #e2e8f0;vertical-align:top;overflow-wrap:anywhere}.blocked{color:#a32118}footer{font-size:12px;color:#475569}@media(max-width:600px){main{margin:0;padding:16px}td,th{padding:6px;font-size:13px}}</style></head><body><main><p>UNIFENAS · NED</p><h1>Ocorrências no acompanhamento docente</h1><p>Prezado(a) ${escapeHtml(recipientName)},</p><p>Relatório gerado em <strong>${escapeHtml(dateTime(meta.generatedAt))}</strong>. Pode haver alterações após essa data.</p><p><b>Disciplinas abrangidas:</b> ${escapeHtml(scope)}.</p><ul>${totals.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul><h2>Ocorrências para acompanhamento</h2>${htmlRows ? `<table><thead><tr><th>Docente</th><th>Disciplina</th><th>Ocorrência</th></tr></thead><tbody>${htmlRows}</tbody></table>` : '<p>Nenhuma ocorrência confirmada para cobrança nesta coleta.</p>'}<p>${escapeHtml(regular)}</p>${validations.length ? `<h2>Revisão pelo NED</h2><ul>${validations.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>` : ''}<p>Ficamos à disposição para esclarecimentos.</p><p>Atenciosamente,<br>NED — UNIFENAS</p>${blocker ? `<p class="blocked">${escapeHtml(blocker)}</p>` : ''}<footer>Referência ${escapeHtml(meta.snapshotId)} · Regras ${escapeHtml(meta.rulesVersion)}</footer></main></body></html>`;
  return { snapshotId: meta.snapshotId, publishAllowed, subject, text, html, totals, details, blocker };
}

module.exports = { buildReport };
