import { ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck, Save, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, apiRequest, toQueryString } from "@/api/client";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { useAuth } from "@/contexts/auth";
import type { ManualDeliveryDisposition, ManualDeliveryItem, ManualDeliveryResponse } from "@/types/dashboard";

interface ManualFilters { period: string; courseId: string; requirementId: string; status: string; query: string; page: number }
interface Draft {
  courseId: string;
  teacherId: string;
  requirementId: "unidades_aprendizagem" | "videos";
  itemNumber: number;
  disposition: ManualDeliveryDisposition;
  evidenceDate: string | null;
  publishedDate: string | null;
  justification: string | null;
}
const EMPTY_FILTERS: ManualFilters = { period: "", courseId: "", requirementId: "", status: "", query: "", page: 1 };
function displayDate(value: string | null) { return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value)) : "Sem prazo"; }
function initialDraft(item: ManualDeliveryItem): Draft {
  return { courseId: item.course.id, teacherId: item.teacher.id, requirementId: item.requirement.baseId as Draft["requirementId"], itemNumber: item.requirement.itemNumber || 1, disposition: item.disposition, evidenceDate: item.evidenceDate, publishedDate: item.publishedDate, justification: item.justification };
}

export function ManualDeliveryPanel({ onUpdated }: { onUpdated: () => Promise<void> }) {
  const { csrfToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<ManualFilters>(EMPTY_FILTERS);
  const [data, setData] = useState<ManualDeliveryResponse | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dirtyCount = Object.keys(drafts).length;

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError(null);
    try {
      const response = await apiRequest<ManualDeliveryResponse>(`/api/operations/manual-deliveries${toQueryString({ ...filters, pageSize: 20 })}`, { signal });
      setData(response); setDrafts({});
    } catch (caught) {
      if ((caught as Error).name !== "AbortError") setError(caught instanceof Error ? caught.message : "Não foi possível carregar o controle manual.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [filters]);
  useEffect(() => { if (!open) return; const controller = new AbortController(); const timeout = window.setTimeout(() => void load(controller.signal), filters.query ? 250 : 0); return () => { window.clearTimeout(timeout); controller.abort(); }; }, [open, load, filters.query]);

  const current = useMemo(() => new Map((data?.items || []).map((item) => [item.id, drafts[item.id] || initialDraft(item)])), [data, drafts]);
  const patchDraft = (item: ManualDeliveryItem, changes: Partial<Draft>) => {
    if (!item.editable) return;
    setMessage(null);
    setDrafts((existing) => ({ ...existing, [item.id]: { ...(existing[item.id] || initialDraft(item)), ...changes } }));
  };
  const patchFilter = (key: keyof ManualFilters, value: string | number) => {
    if (dirtyCount) return;
    setFilters((existing) => ({ ...existing, [key]: value, page: key === "page" ? Number(value) : 1 }));
  };
  const toggle = () => {
    if (open && dirtyCount) { setError("Salve ou descarte as alterações antes de fechar o controle."); return; }
    setOpen((value) => !value);
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

  return <section className={`manual-section${open ? " is-open" : ""}`}>
    <div className="manual-summary">
      <div><span className="eyebrow"><ClipboardCheck size={14} />Controle do NED</span><h2>UA e videoaulas informadas pelo docente</h2><p>UA usa a data de envio. Videoaula usa a data de gravação.</p></div>
      <button className="secondary-button" type="button" onClick={toggle} aria-expanded={open}><ChevronDown size={17} />{open ? "Fechar controle" : "Abrir controle"}</button>
    </div>
    {open && <div className="manual-workspace">
      <div className="manual-note"><strong>Publicado é operacional.</strong><span>A data de publicação é opcional e não altera a avaliação do docente. “Não aplicável” exige justificativa.</span></div>
      <div className="manual-filters">
        <label className="search-field"><Search size={17} aria-hidden="true" /><span className="sr-only">Buscar</span><input disabled={Boolean(dirtyCount)} value={filters.query} onChange={(event) => patchFilter("query", event.target.value)} placeholder="Buscar docente, disciplina ou item" /></label>
        <label><span>Período</span><select disabled={Boolean(dirtyCount)} value={filters.period} onChange={(event) => patchFilter("period", event.target.value)}><option value="">Todos</option>{data?.filters.periods.map((period) => <option key={period}>{period}</option>)}</select></label>
        <label><span>Tipo</span><select disabled={Boolean(dirtyCount)} value={filters.requirementId} onChange={(event) => patchFilter("requirementId", event.target.value)}><option value="">UA e videoaulas</option><option value="unidades_aprendizagem">Unidades de aprendizagem</option><option value="videos">Videoaulas</option></select></label>
        <label><span>Situação</span><select disabled={Boolean(dirtyCount)} value={filters.status} onChange={(event) => patchFilter("status", event.target.value)}><option value="">Todas</option><option value="PENDING">Pendente</option><option value="DELIVERED_ON_TIME">Entregue no prazo</option><option value="DELIVERED_LATE">Entregue com atraso</option><option value="NOT_APPLICABLE">Não aplicável</option><option value="INHERITED_READY">Estrutura herdada</option></select></label>
      </div>
      {error && <div className="manual-feedback feedback-error" role="alert">{error}{!data && <button type="button" onClick={() => void load()}>Tentar novamente</button>}</div>}
      {message && <div className="manual-feedback feedback-success" role="status">{message}</div>}
      {loading && !data ? <div className="manual-loading"><span className="spinner" />Carregando itens…</div> : data && <>
        <div className="manual-table-wrap"><table className="manual-table"><thead><tr><th>Disciplina e docente</th><th>Item</th><th>Prazo</th><th>Registro</th><th>Data do docente</th><th>Publicação</th><th>Situação</th></tr></thead><tbody>{data.items.map((item) => {
          const draft = current.get(item.id) || initialDraft(item);
          const evidenceLabel = item.requirement.evidenceType === "SENT_BY_TEACHER" ? "Data do envio" : "Data da gravação";
          return <tr key={item.id} className={drafts[item.id] ? "manual-row-dirty" : ""}>
            <td data-label="Disciplina e docente"><strong>{item.course.shortName}</strong><small>{item.teacher.name}</small></td>
            <td data-label="Item"><strong>{item.requirement.label}</strong><small>{evidenceLabel}</small></td>
            <td data-label="Prazo"><time>{displayDate(item.deadlineAt)}</time></td>
            <td data-label="Registro">{item.editable ? <select aria-label={`Registro de ${item.requirement.label}`} value={draft.disposition} onChange={(event) => patchDraft(item, { disposition: event.target.value as ManualDeliveryDisposition })}><option value="PENDING">Pendente</option><option value="DELIVERED">Entregue</option><option value="NOT_APPLICABLE">Não aplicável</option></select> : <span className="locked-value">Dispensado</span>}</td>
            <td data-label="Data do docente">{item.editable && draft.disposition === "DELIVERED" ? <input aria-label={`${evidenceLabel} de ${item.requirement.label}`} type="date" value={draft.evidenceDate || ""} onChange={(event) => patchDraft(item, { evidenceDate: event.target.value || null })} /> : item.editable && draft.disposition === "NOT_APPLICABLE" ? <input aria-label={`Justificativa de ${item.requirement.label}`} type="text" maxLength={500} value={draft.justification || ""} onChange={(event) => patchDraft(item, { justification: event.target.value })} placeholder="Justificativa obrigatória" /> : <span className="empty-value">—</span>}</td>
            <td data-label="Publicação">{item.editable && draft.disposition !== "NOT_APPLICABLE" ? <input aria-label={`Data de publicação de ${item.requirement.label}`} type="date" value={draft.publishedDate || ""} onChange={(event) => patchDraft(item, { publishedDate: event.target.value || null })} /> : <span className="empty-value">—</span>}</td>
            <td data-label="Situação"><StatusBadge status={item.status} />{item.updatedBy && <small>Por {item.updatedBy}</small>}</td>
          </tr>;
        })}</tbody></table></div>
        {data.items.length === 0 && <div className="empty-state"><strong>Nenhum item encontrado</strong><span>Altere os filtros para continuar.</span></div>}
        <div className="manual-footer"><nav className="pagination" aria-label="Paginação do controle manual"><button type="button" disabled={filters.page <= 1 || Boolean(dirtyCount)} onClick={() => patchFilter("page", filters.page - 1)}><ChevronLeft size={16} />Anterior</button><span>Página {data.pagination.page} de {data.pagination.pages} · {data.pagination.total} itens</span><button type="button" disabled={filters.page >= data.pagination.pages || Boolean(dirtyCount)} onClick={() => patchFilter("page", filters.page + 1)}>Próxima<ChevronRight size={16} /></button></nav><div className="manual-actions">{Boolean(dirtyCount) && <button className="secondary-button" type="button" disabled={saving} onClick={() => { setDrafts({}); setError(null); }}>Descartar</button>}<button className="primary-button" type="button" disabled={!dirtyCount || saving} onClick={() => void save()}><Save size={16} />{saving ? "Salvando…" : dirtyCount ? `Salvar ${dirtyCount} alteração${dirtyCount === 1 ? "" : "ões"}` : "Sem alterações"}</button></div></div>
      </>}
    </div>}
  </section>;
}
