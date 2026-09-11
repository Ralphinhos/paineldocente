import { Download, Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { apiRequest, ApiError, toQueryString } from '@/api/client';
import { useAuth } from '@/contexts/auth';
import type { ReportPreview } from '@/types/dashboard';
interface Props { open: boolean; onClose: () => void }
export function ReportPreviewDialog({ open, onClose }: Props) {
  const { user, csrfToken } = useAuth();
  const forcedAudience = user?.role === 'executive' ? 'executive' : user?.role === 'coordinator' ? 'coordinators' : null;
  const [audience, setAudience] = useState<'coordinators' | 'executive'>(forcedAudience || 'coordinators');
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [recipientIndex, setRecipientIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController(); setLoading(true); setMessage(null); setPreview(null); setRecipientIndex(0);
    apiRequest<ReportPreview>(`/api/reports/preview${toQueryString({ audience })}`, { signal: controller.signal }).then(setPreview).catch((error) => { if (error.name !== 'AbortError') setMessage(error.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, audience]);
  const report = preview?.reports[recipientIndex];
  const send = async () => {
    if (!report) return;
    setLoading(true); setMessage(null);
    try { await apiRequest('/api/reports/send', { method: 'POST', body: JSON.stringify({ audience, snapshotId: report.snapshotId }), csrfToken }); setMessage('Relatórios encaminhados e registrados.'); }
    catch (error) { setMessage(error instanceof ApiError ? error.message : 'Falha no envio.'); }
    finally { setLoading(false); }
  };
  const download = () => {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([report.html], { type: 'text/html;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `relatorio-docente-${audience}-${report.snapshotId.slice(0, 8)}.html`; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <dialog ref={dialog} className="report-dialog" onCancel={onClose} aria-labelledby="report-title">
    {open && <section className="report-modal"><header><div><h2 id="report-title">Relatório semanal</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Fechar"><X size={20} /></button></header>
      <div className="report-controls"><label><span>Público</span><select disabled={Boolean(forcedAudience) || loading} value={audience} onChange={(event) => setAudience(event.target.value as typeof audience)}><option value="coordinators">Coordenações · detalhado</option><option value="executive">Alta gestão · resumo</option></select></label><label><span>Destinatário da prévia</span><select value={recipientIndex} onChange={(event) => setRecipientIndex(Number(event.target.value))} disabled={loading || !preview?.reports.length}>{preview?.reports.map((item, index) => <option key={index} value={index}>{item.recipient ? `${item.recipient.name} · ${item.recipient.email}` : 'Prévia sem destinatário'}</option>)}</select></label></div>
      <div className="report-preview">{loading && !report ? <div className="dialog-loading">Preparando relatório…</div> : report ? <iframe title="Prévia do relatório" sandbox="" srcDoc={report.html} /> : <p>Prévia indisponível.</p>}</div>
      {message && <div className="inline-message" role="status">{message}</div>}
      <footer><span>{report?.publishAllowed ? `${preview?.reports.length || 0} destinatários configurados para envio.` : 'Envio bloqueado até validação.'}</span><div><button className="secondary-button" type="button" disabled={!report || loading} onClick={download}><Download size={16} />Baixar HTML</button>{user?.role === 'ned_admin' && <button className="primary-button" type="button" disabled={!report?.publishAllowed || loading} onClick={() => void send()}><Send size={16} />Enviar relatórios</button>}</div></footer>
    </section>}
  </dialog>;
}
