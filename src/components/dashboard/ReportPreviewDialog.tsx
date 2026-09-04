import { MailCheck, Send, X } from "lucide-react";
import { useEffect, useState } from "react";
import { apiRequest, ApiError, toQueryString } from "@/api/client";
import { useAuth } from "@/contexts/auth";
import type { DashboardData, ReportPreview } from "@/types/dashboard";

interface Props { open: boolean; meta: DashboardData["meta"]; onClose: () => void }
export function ReportPreviewDialog({ open, meta, onClose }: Props) {
  const { user, csrfToken } = useAuth();
  const forcedAudience = user?.role === "executive" ? "executive" : user?.role === "coordinator" ? "coordinators" : null;
  const [audience, setAudience] = useState<"coordinators" | "executive">(forcedAudience || "coordinators");
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController(); setLoading(true); setMessage(null); setPreview(null);
    apiRequest<ReportPreview>(`/api/reports/preview${toQueryString({ audience })}`, { signal: controller.signal }).then(setPreview).catch((error) => { if (error.name !== "AbortError") setMessage(error.message); }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [open, audience]);
  useEffect(() => { if (!open) return; const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; document.addEventListener("keydown", close); return () => document.removeEventListener("keydown", close); }, [open, onClose]);
  if (!open) return null;
  const send = async () => { setLoading(true); setMessage(null); try { await apiRequest("/api/reports/send", { method: "POST", body: JSON.stringify({ audience }), csrfToken }); setMessage("Relatório encaminhado e registrado na auditoria."); } catch (error) { setMessage(error instanceof ApiError ? error.message : "Falha no envio."); } finally { setLoading(false); } };
  const report = preview?.reports[0];
  return <div className="modal-layer" role="presentation"><section className="report-modal" role="dialog" aria-modal="true" aria-labelledby="report-title"><header><div><span className="eyebrow"><MailCheck size={14} />Relatório semanal</span><h2 id="report-title">Prévia antes do envio</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Fechar"><X size={20} /></button></header>
    <div className="report-controls"><label><span>Público</span><select disabled={Boolean(forcedAudience)} value={audience} onChange={(event) => setAudience(event.target.value as typeof audience)}><option value="coordinators">Coordenações · detalhado</option><option value="executive">Pró-reitoria e Reitoria · resumo</option></select></label><div><span>Destinatário</span><strong>{report?.recipient ? `${report.recipient.name} · ${report.recipient.email}` : "Definido somente no servidor"}</strong></div></div>
    <div className="report-preview">{loading && !report ? <div className="dialog-loading"><span className="spinner" />Gerando prévia…</div> : report ? <><strong className="email-subject">{report.subject}</strong><pre>{report.text}</pre></> : <p>Prévia indisponível.</p>}</div>
    {message && <div className="inline-message" role="status">{message}</div>}
    <footer><span>{meta.publishAllowed ? "Dados liberados pelo controle de qualidade." : "Envio bloqueado pelo controle de qualidade."}</span><div><button className="secondary-button" type="button" onClick={onClose}>Fechar</button>{user?.role === "ned_admin" && <button className="primary-button" type="button" disabled={!meta.publishAllowed || loading} onClick={() => void send()}><Send size={16} />Enviar relatório</button>}</div></footer>
  </section></div>;
}
