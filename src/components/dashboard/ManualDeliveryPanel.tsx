import { ChevronLeft, ChevronRight, History, RefreshCw, Save, Search } from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, apiRequest, toQueryString } from "@/api/client";
import { DelayLabel } from "@/components/dashboard/DelayLabel";
import { useAuth } from "@/contexts/auth";
import type { ManualDeliveryDisposition, ManualDeliveryItem, ManualDeliveryResponse } from "@/types/dashboard";

interface ManualFilters { period: string; courseId: string; requirementId: string; status: string; query: string; page: number }
interface Draft {
  courseId: string;
  teacherId: string;
  requirementId: "unidades_aprendizagem" | "videos";
  itemNumber: number;
  revision: number;
  disposition: ManualDeliveryDisposition;
  evidenceDate: string | null;
  publishedDate: string | null;
  justification: string | null;
}
interface RevisionDraft { itemId: string; reason: string; deadlineDate: string; allVideos: boolean }
const EMPTY_FILTERS: ManualFilters = { period: "", courseId: "", requirementId: "", status: "", query: "", page: 1 };
function displayDate(value: string | null, empty = "Sem prazo") { if (!value) return empty; const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value; return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(normalized)); }
function historyLabel(value: ManualDeliveryItem["history"][number]["disposition"]) { return { PENDING: "Pendente", DELIVERED: "Entregue", NOT_APPLICABLE: "Não aplicável", INHERITED_READY: "Estrutura herdada" }[value]; }
function initialDraft(item: ManualDeliveryItem): Draft {
  return { courseId: item.course.id, teacherId: item.teacher.id, requirementId: item.requirement.baseId as Draft["requirementId"], itemNumber: item.requirement.itemNumber || 1, revision: item.version, disposition: item.disposition, evidenceDate: item.evidenceDate, publishedDate: item.publishedDate, justification: item.justification };
}

export function ManualDeliveryPanel({ active, onDirtyChange, onUpdated }: { active: boolean; onDirtyChange: (dirty: boolean) => void; onUpdated: () => Promise<void> }) {
  const { csrfToken } = useAuth();

  const [filters, setFilters] = useState<ManualFilters>(EMPTY_FILTERS);
  const [data, setData] = useState<ManualDeliveryResponse | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [revisionDraft, setRevisionDraft] = useState<RevisionDraft | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dirtyCount = Object.keys(drafts).length;
  useEffect(() => { onDirtyChange(Boolean(dirtyCount || revisionDraft || saving)); }, [dirtyCount, revisionDraft, saving, onDirtyChange]);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError(null);
    try {
      const response = await apiRequest<ManualDeliveryResponse>(`/api/operations/manual-deliveries${toQueryString({ ...filters, pageSize: 20 })}`, { signal });
      setData(response); setDrafts({});
    } catch (caught) {
      if ((caught as Error).name !== "AbortError") setError(caught instanceof Error ? caught.message : "Não foi possível carregar o controle manual.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [filters]);
  useEffect(() => { if (!active) return; const controller = new AbortController(); const timeout = window.setTimeout(() => void load(controller.signal), filters.query ? 250 : 0); return () => { window.clearTimeout(timeout); controller.abort(); }; }, [active, load, filters.query]);

  const current = useMemo(() => new Map((data?.items || []).map((item) => [item.id, drafts[item.id] || initialDraft(item)])), [data, drafts]);
  const patchDraft = (item: ManualDeliveryItem, changes: Partial<Draft>) => {
    if (!item.editable) return;
    if (revisionDraft) { setError("Conclua ou cancele a abertura da nova versão antes de editar registros."); return; }
    setMessage(null);
    setDrafts((existing) => ({ ...existing, [item.id]: { ...(existing[item.id] || initialDraft(item)), ...changes } }));
  };
  const patchFilter = (key: keyof ManualFilters, value: string | number) => {
    if (dirtyCount || revisionDraft) return;
    setFilters((existing) => ({ ...existing, [key]: value, page: key === "page" ? Number(value) : 1 }));
  };
  const createRevision = async (item: ManualDeliveryItem) => {
    if (!data || !revisionDraft || revisionDraft.itemId !== item.id) return;
    if (revisionDraft.reason.trim().length < 3 || !revisionDraft.deadlineDate) { setError("Informe o motivo e o novo prazo da substituição."); return; }
    setSaving(true); setError(null); setMessage(null);
    try {
      const response = await apiRequest<{ created: number }>("/api/operations/manual-deliveries/revisions", { method: "POST", csrfToken, body: JSON.stringify({ snapshotId: data.meta.snapshotId, courseId: item.course.id, teacherId: item.teacher.id, requirementId: item.requirement.baseId, itemNumber: item.requirement.itemNumber || 1, scope: revisionDraft.allVideos ? "ALL_VIDEOS" : "ITEM", reason: revisionDraft.reason, deadlineDate: revisionDraft.deadlineDate }) });
      setRevisionDraft(null);
      setMessage(`${response.created} nova${response.created === 1 ? "" : "s"} versão${response.created === 1 ? "" : "ões"} aberta${response.created === 1 ? "" : "s"}. Histórico anterior preservado.`);
      await Promise.all([load(), onUpdated()]);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Não foi possível abrir a nova versão.");
    } finally { setSaving(false); }
  };
  const save = async () => {
    if (!data || !dirtyCount) return;
    const deliveries = Object.values(drafts);
    const invalid = deliveries.find((item) => item.disposition === "DELIVERED" && !item.evidenceDate || item.disposition === "NOT_APPLICABLE" && (!item.justification || item.justification.trim().length < 3));
    if (invalid) { setError("Preencha a data do docente ou a justificativa obrigatória."); return; }
    setSaving(true); setError(null); setMessage(null);
    try {
      await apiRequest("/api/operations/manual-deliveries", { method: "POST", csrfToken, body: JSON.stringify({ snapshotId: data.meta.snapshotId, deliveries }) });
      setMessage(`${deliveries.length} item${deliveries.length === 1 ? "" : "s"} salvo${deliveries.length === 1 ? "" : "s"}. Indicadores atualizados.`);
      await Promise.all([load(), onUpdated()]);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Não foi possível salvar os registros.");
    } finally { setSaving(false); }
  };

  return <section className="manual-section is-open">
    <div className="manual-summary"><div><h2>Pacote de UAs e videoaulas</h2></div><details className="manual-help"><summary>Como registrar?</summary><p>UA: data de envio do pacote. Vídeo: data da gravação. Publicação é apenas operacional.</p><p>Corrija datas no registro. Para substituir material, use “Trocar pacote” ou “Regravar”; informe motivo e novo prazo.</p></details></div>
    <div className="manual-workspace">
      <div className="manual-filters">
        <label className="search-field"><Search size={17} aria-hidden="true" /><span className="sr-only">Buscar</span><input disabled={Boolean(dirtyCount || revisionDraft)} value={filters.query} onChange={(event) => patchFilter("query", event.target.value)} placeholder="Buscar docente, disciplina ou item" /></label>
        <label><span>Período</span><select disabled={Boolean(dirtyCount || revisionDraft)} value={filters.period} onChange={(event) => patchFilter("period", event.target.value)}><option value="">Todos</option>{data?.filters.periods.map((period) => <option key={period}>{period}</option>)}</select></label>
        <label><span>Tipo</span><select disabled={Boolean(dirtyCount || revisionDraft)} value={filters.requirementId} onChange={(event) => patchFilter("requirementId", event.target.value)}><option value="">UA e videoaulas</option><option value="unidades_aprendizagem">Pacote de UAs</option><option value="videos">Videoaulas</option></select></label>
        <label><span>Situação</span><select disabled={Boolean(dirtyCount || revisionDraft)} value={filters.status} onChange={(event) => patchFilter("status", event.target.value)}><option value="">Todas</option><option value="PENDING">Pendente</option><option value="DELIVERED_ON_TIME">Entregue no prazo</option><option value="DELIVERED_LATE">Entregue com atraso</option><option value="NOT_APPLICABLE">Não aplicável</option><option value="INHERITED_READY">Estrutura herdada</option></select></label>
      </div>
      {error && <div className="manual-feedback feedback-error" role="alert">{error}{!data && <button type="button" onClick={() => void load()}>Tentar novamente</button>}</div>}
      {message && <div className="manual-feedback feedback-success" role="status">{message}</div>}
      {loading && !data ? <div className="manual-loading"><span className="spinner" />Carregando itens…</div> : data && <>
        <div className="manual-table-wrap"><table className="manual-table"><thead><tr><th>Disciplina e docente</th><th>Item</th><th>Prazo</th><th>Registro</th><th>Data do docente</th><th>Publicação</th><th>Situação</th></tr></thead><tbody>{data.items.map((item) => {
          const draft = current.get(item.id) || initialDraft(item);
          const evidenceLabel = item.requirement.evidenceType === "SENT_BY_TEACHER" ? "Data do envio" : "Data da gravação";
          const activeRevision = revisionDraft?.itemId === item.id ? revisionDraft : null;
          const showingHistory = expandedHistory === item.id;
          return <Fragment key={item.id}>
            <tr className={drafts[item.id] ? "manual-row-dirty" : ""}>
              <td data-label="Disciplina e docente"><strong>{item.course.shortName}</strong><small>{item.teacher.name}</small></td>
              <td data-label="Item"><strong>{item.requirement.label}</strong><small>{evidenceLabel} · Versão {item.version}</small></td>
              <td data-label="Prazo"><time>{displayDate(item.deadlineAt)}</time>{item.version > 1 && <small>Novo prazo da versão</small>}</td>
              <td data-label="Registro">{item.editable ? <select aria-label={`Registro de ${item.requirement.label}`} value={draft.disposition} onChange={(event) => patchDraft(item, { disposition: event.target.value as ManualDeliveryDisposition })}><option value="PENDING">Pendente</option><option value="DELIVERED">Entregue</option><option value="NOT_APPLICABLE">Não aplicável</option></select> : <span className="locked-value">Dispensado</span>}</td>
              <td data-label="Data do docente">{item.editable && draft.disposition === "DELIVERED" ? <input aria-label={`${evidenceLabel} de ${item.requirement.label}`} type="date" value={draft.evidenceDate || ""} onChange={(event) => patchDraft(item, { evidenceDate: event.target.value || null })} /> : item.editable && draft.disposition === "NOT_APPLICABLE" ? <input aria-label={`Justificativa de ${item.requirement.label}`} type="text" maxLength={500} value={draft.justification || ""} onChange={(event) => patchDraft(item, { justification: event.target.value })} placeholder="Justificativa obrigatória" /> : <span className="empty-value">—</span>}</td>
              <td data-label="Publicação">{item.editable && draft.disposition !== "NOT_APPLICABLE" ? <input aria-label={`Data de publicação de ${item.requirement.label}`} type="date" value={draft.publishedDate || ""} onChange={(event) => patchDraft(item, { publishedDate: event.target.value || null })} /> : <span className="empty-value">—</span>}</td>
              <td data-label="Situação">
                <DelayLabel item={item} />
                <div className="row-actions">
                  {item.canCreateRevision && <button type="button" disabled={Boolean(dirtyCount || saving || revisionDraft)} onClick={() => { setExpandedHistory(null); setError(null); setRevisionDraft({ itemId: item.id, reason: "", deadlineDate: "", allVideos: false }); }}><RefreshCw size={14} />{item.requirement.baseId === "videos" ? "Regravar" : "Trocar pacote"}</button>}
                  {item.history.length > 1 && <button type="button" onClick={() => setExpandedHistory(showingHistory ? null : item.id)}><History size={14} />Histórico ({item.history.length})</button>}
                </div>
              </td>
            </tr>
            {activeRevision && <tr className="revision-editor-row"><td colSpan={7}>
              <div className="revision-editor">
                <div><strong>{item.requirement.baseId === "videos" ? "Abrir nova gravação" : "Abrir novo pacote de UAs"}</strong><span>A versão {item.version} continuará no histórico.</span></div>
                <label><span>Motivo da substituição</span><input autoFocus type="text" maxLength={500} value={activeRevision.reason} onChange={(event) => setRevisionDraft({ ...activeRevision, reason: event.target.value })} placeholder="Ex.: atualização do conteúdo da disciplina" /></label>
                <label><span>Novo prazo</span><input type="date" value={activeRevision.deadlineDate} onChange={(event) => setRevisionDraft({ ...activeRevision, deadlineDate: event.target.value })} /></label>
                {item.requirement.baseId === "videos" && <label className="revision-check"><input type="checkbox" checked={activeRevision.allVideos} onChange={(event) => setRevisionDraft({ ...activeRevision, allVideos: event.target.checked })} /><span>Regravar todas as videoaulas desta disciplina</span></label>}
                <div className="revision-actions"><button className="secondary-button" type="button" disabled={saving} onClick={() => setRevisionDraft(null)}>Cancelar</button><button className="primary-button" type="button" disabled={saving} onClick={() => void createRevision(item)}><RefreshCw size={15} />{saving ? "Abrindo…" : "Abrir nova versão"}</button></div>
              </div>
            </td></tr>}
            {showingHistory && <tr className="history-row"><td colSpan={7}>
              <div className="version-history"><strong>Histórico preservado</strong><ol>{item.history.map((entry) => <li key={entry.version}><b>Versão {entry.version}</b><span>{historyLabel(entry.disposition)}</span>{entry.revisionDeadlineDate && <span>Prazo: {displayDate(entry.revisionDeadlineDate)}</span>}{entry.evidenceDate && <span>Docente: {displayDate(entry.evidenceDate, "—")}</span>}{entry.replacementReason && <small>{entry.replacementReason}</small>}</li>)}</ol></div>
            </td></tr>}
          </Fragment>;
        })}</tbody></table></div>
        {data.items.length === 0 && <div className="empty-state"><strong>Nenhum item encontrado</strong><span>Altere os filtros para continuar.</span></div>}
        <div className="manual-footer"><nav className="pagination" aria-label="Paginação do controle manual"><button type="button" disabled={filters.page <= 1 || Boolean(dirtyCount || revisionDraft)} onClick={() => patchFilter("page", filters.page - 1)}><ChevronLeft size={16} />Anterior</button><span>Página {data.pagination.page} de {data.pagination.pages} · {data.pagination.total} itens</span><button type="button" disabled={filters.page >= data.pagination.pages || Boolean(dirtyCount || revisionDraft)} onClick={() => patchFilter("page", filters.page + 1)}>Próxima<ChevronRight size={16} /></button></nav><div className="manual-actions">{Boolean(dirtyCount) && <button className="secondary-button" type="button" disabled={saving} onClick={() => { setDrafts({}); setError(null); }}>Descartar</button>}<button className="primary-button" type="button" disabled={!dirtyCount || saving || Boolean(revisionDraft)} onClick={() => void save()}><Save size={16} />{saving ? "Salvando…" : dirtyCount ? `Salvar ${dirtyCount} alteração${dirtyCount === 1 ? "" : "ões"}` : "Sem alterações"}</button></div></div>
      </>}
    </div>
  </section>;
}
