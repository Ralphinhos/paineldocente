import { Check, Copy, Download, Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { apiRequest, ApiError, toQueryString } from '@/api/client';
import { WorkspaceTabs } from '@/components/ui/WorkspaceTabs';
import { useAuth } from '@/contexts/auth';
import type { ReportPreview } from '@/types/dashboard';
interface Props { open: boolean; onClose: () => void; inline?: boolean }
export function ReportPreviewDialog({ open, onClose, inline = false }: Props) {
  const { user, csrfToken } = useAuth();
  const forcedAudience = user?.role === 'executive' ? 'executive' : user?.role === 'coordinator' ? 'coordinators' : null;
  const [audience, setAudience] = useState<'coordinators' | 'executive'>(forcedAudience || 'coordinators');
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [recipientIndex, setRecipientIndex] = useState(0);
  const [view, setView] = useState('email');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null);
  const [retry, setRetry] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (inline) return;
    if (open && !dialog.current?.open) dialog.current?.showModal();
    else if (!open) dialog.current?.close();
  }, [open, inline]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true); setFeedback(null); setPreview(null); setRecipientIndex(0); setCopied(false);
    apiRequest<ReportPreview>('/api/reports/preview' + toQueryString({ audience }), { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setPreview(result); })
      .catch((error) => { if (error.name !== 'AbortError') setFeedback({ text: error.message, error: true }); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, audience, retry]);
  const report = preview?.reports[recipientIndex];
  const recipients = preview?.reports.filter((item) => item.recipient) || [];
  const canSend = Boolean(preview?.reports.length && preview.reports.every((item) => item.publishAllowed && item.recipient));
  const send = async () => {
    if (!report || !canSend) return;
    setLoading(true); setFeedback(null);
    try {
      const result = await apiRequest<{ results: Array<{ status: string }> }>('/api/reports/send', { method: 'POST', body: JSON.stringify({ audience, snapshotId: report.snapshotId }), csrfToken });
      const sent = result.results.filter((item) => item.status === 'SENT').length;
      const already = result.results.filter((item) => item.status === 'ALREADY_SENT').length;
      const processing = result.results.filter((item) => item.status === 'IN_PROGRESS').length;
      setFeedback({ text: sent + ' enviado(s)' + (already ? ' · ' + already + ' já enviado(s) anteriormente' : '') + (processing ? ' · ' + processing + ' em processamento' : '') + '.', error: false });
    } catch (error) { setFeedback({ text: error instanceof ApiError ? error.message : 'Não foi possível enviar. Tente novamente.', error: true }); }
    finally { setLoading(false); }
  };
  const download = () => {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([report.html], { type: 'text/html;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'relatorio-' + audience + '-' + (report.recipient?.email || 'previa').replace(/[^a-zA-Z0-9-]/g, '_') + '-' + report.snapshotId.slice(0, 8) + '.html';
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const copyEmail = async () => {
    if (!report) return;
    try { await navigator.clipboard.writeText(report.text); setCopied(true); }
    catch { setFeedback({ text: 'Selecione e copie o texto da prévia. O navegador não liberou a cópia automática.', error: true }); }
  };
  const content = <section className={inline ? 'report-panel' : 'report-modal'} aria-labelledby={inline ? 'report-inline-title' : 'report-title'}>
    <header className="report-heading"><div><h2 id={inline ? 'report-inline-title' : 'report-title'}>Preparar relatórios</h2><p>Confira o destinatário e o conteúdo antes do envio.</p></div>{!inline && <button className="icon-button" type="button" onClick={onClose} aria-label="Fechar relatório"><X size={20} /></button>}</header>
    <div className="report-controls">
      <label><span>Público</span><select disabled={Boolean(forcedAudience) || loading} value={audience} onChange={(event) => setAudience(event.target.value as typeof audience)}><option value="coordinators">Coordenações · detalhado</option><option value="executive">Alta gestão · resumo</option></select></label>
      <label><span>Destinatário</span><select value={recipientIndex} onChange={(event) => { setRecipientIndex(Number(event.target.value)); setCopied(false); setFeedback(null); }} disabled={loading || !preview?.reports.length}>{preview?.reports.map((item, index) => <option key={item.recipient?.email || index} value={index}>{item.recipient ? item.recipient.name + ' · ' + item.recipient.email : 'Prévia geral · sem destinatário'}</option>)}</select></label>
    </div>
    {loading && !report ? <div className="report-loading" role="status"><div className="skeleton-line" /><div className="skeleton-line" /><span>Preparando relatório…</span></div> : report ? <>
      <div className="report-envelope"><span>Para</span><strong>{report.recipient?.email || 'Nenhum destinatário configurado'}</strong><span>Assunto</span><strong>{report.subject}</strong></div>
      <WorkspaceTabs id={inline ? 'report-inline' : 'report-preview'} label="Formato da prévia" compact value={view} onChange={setView} tabs={[{ id: 'email', label: 'Texto do e-mail' }, { id: 'html', label: 'Relatório HTML' }]} />
      <div className="report-preview" role="tabpanel" id={(inline ? 'report-inline' : 'report-preview') + '-panel-email'} aria-labelledby={(inline ? 'report-inline' : 'report-preview') + '-tab-email'} hidden={view !== 'email'}><pre className="report-mail">{report.text}</pre></div>
      <div className="report-preview" role="tabpanel" id={(inline ? 'report-inline' : 'report-preview') + '-panel-html'} aria-labelledby={(inline ? 'report-inline' : 'report-preview') + '-tab-html'} hidden={view !== 'html'}><iframe title="Prévia do relatório HTML" sandbox="" srcDoc={report.html} /></div>
    </> : <div className="empty-state"><strong>Prévia indisponível</strong><button className="secondary-button" type="button" onClick={() => setRetry((value) => value + 1)}>Tentar novamente</button></div>}
    {feedback && <div className={'inline-message ' + (feedback.error ? 'feedback-error' : 'feedback-success')} role={feedback.error ? 'alert' : 'status'}>{feedback.text}</div>}
    <footer className="report-footer"><span>{canSend ? recipients.length + ' destinatário(s). O envio inclui todos deste público.' : report?.blocker || 'Configure e confira os destinatários antes de enviar.'}</span><div><button className="secondary-button" type="button" disabled={!report || loading} onClick={() => void copyEmail()}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Texto copiado' : 'Copiar texto'}</button><button className="secondary-button" type="button" disabled={!report || loading} onClick={download}><Download size={16} />Baixar HTML</button>{user?.role === 'ned_admin' && <button className="primary-button" type="button" disabled={!canSend || loading} onClick={() => void send()}><Send size={16} />{loading ? 'Aguarde…' : 'Enviar para todos (' + recipients.length + ')'}</button>}</div></footer>
  </section>;
  if (inline) return open ? content : null;
  return <dialog ref={dialog} className="report-dialog" onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} aria-labelledby="report-title">{open && content}</dialog>;
}
