import { ChevronLeft, ChevronRight, History, RefreshCw, Save, Search } from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, apiRequest, toQueryString } from '@/api/client';
import { DelayLabel } from '@/components/dashboard/DelayLabel';
import { useAuth } from '@/contexts/auth';
import { formatDate } from '@/lib/presentation';
import type { ManualDeliveryDisposition, ManualDeliveryItem, ManualDeliveryResponse } from '@/types/dashboard';

interface ManualFilters { period: string; courseId: string; requirementId: string; status: string; query: string; page: number }
interface Draft {
  courseId: string; teacherId: string; requirementId: 'unidades_aprendizagem' | 'videos';
  itemNumber: number; revision: number; disposition: ManualDeliveryDisposition;
  evidenceDate: string | null; publishedDate: string | null; justification: string | null;
}
interface RevisionDraft { itemId: string; reason: string; deadlineDate: string; allVideos: boolean }
const EMPTY_FILTERS: ManualFilters = { period: '', courseId: '', requirementId: '', status: '', query: '', page: 1 };
function historyLabel(value: ManualDeliveryItem['history'][number]['disposition']) {
  return { PENDING: 'Pendente', DELIVERED: 'Entregue', NOT_APPLICABLE: 'Não aplicável', INHERITED_READY: 'Replicado no prazo' }[value];
}
function initialDraft(item: ManualDeliveryItem): Draft {
  return { courseId: item.course.id, teacherId: item.teacher.id, requirementId: item.requirement.baseId as Draft['requirementId'], itemNumber: item.requirement.itemNumber || 1, revision: item.version, disposition: item.disposition, evidenceDate: item.evidenceDate, publishedDate: item.publishedDate, justification: item.justification };
}

export function ManualDeliveryPanel({ active, refreshKey, onDirtyChange, onUpdated }: { active: boolean; refreshKey: number; onDirtyChange: (dirty: boolean) => void; onUpdated: () => Promise<void> }) {
  const { csrfToken } = useAuth();
  const [filters, setFilters] = useState<ManualFilters>(EMPTY_FILTERS);
  const [data, setData] = useState<ManualDeliveryResponse | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [revisionDraft, setRevisionDraft] = useState<RevisionDraft | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [showPublication, setShowPublication] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dirtyCount = Object.keys(drafts).length;
  const editingLocked = loading || saving || Boolean(revisionDraft);
  const filtersLocked = Boolean(dirtyCount || revisionDraft || saving);
  useEffect(() => { onDirtyChange(Boolean(dirtyCount || revisionDraft || saving)); }, [dirtyCount, revisionDraft, saving, onDirtyChange]);
  useEffect(() => {
    if (!dirtyCount && !revisionDraft) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirtyCount, revisionDraft]);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError(null);
    try {
      const response = await apiRequest<ManualDeliveryResponse>('/api/operations/manual-deliveries' + toQueryString({ ...filters, pageSize: 20 }), { signal });
      if (!signal?.aborted) { setData(response); setDrafts({}); }
    } catch (caught) {
      if ((caught as Error).name !== 'AbortError') setError(caught instanceof Error ? caught.message : 'Não foi possível carregar o controle manual.');
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [filters]);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => void load(controller.signal), filters.query ? 250 : 0);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [active, load, filters.query, refreshKey]);

  const current = useMemo(() => new Map((data?.items || []).map((item) => [item.id, drafts[item.id] || initialDraft(item)])), [data, drafts]);
  const patchDraft = (item: ManualDeliveryItem, changes: Partial<Draft>) => {
    if (!item.editable || editingLocked) return;
    setMessage(null);
    setDrafts((existing) => ({ ...existing, [item.id]: { ...(existing[item.id] || initialDraft(item)), ...changes } }));
  };
  const patchFilter = (key: keyof ManualFilters, value: string | number) => {
    if (filtersLocked) return;
    setLoading(true);
    setExpandedHistory(null);
    setFilters((existing) => ({ ...existing, [key]: value, page: key === 'page' ? Number(value) : 1 }));
  };
  const createRevision = async (item: ManualDeliveryItem) => {
    if (!data || !revisionDraft || revisionDraft.itemId !== item.id || saving) return;
    if (revisionDraft.reason.trim().length < 3 || !revisionDraft.deadlineDate) { setError('Informe o motivo e o novo prazo da substituição.'); return; }
    setSaving(true); setError(null); setMessage(null);
    try {
      const response = await apiRequest<{ created: number }>('/api/operations/manual-deliveries/revisions', { method: 'POST', csrfToken, body: JSON.stringify({ snapshotId: data.meta.snapshotId, courseId: item.course.id, teacherId: item.teacher.id, requirementId: item.requirement.baseId, itemNumber: item.requirement.itemNumber || 1, scope: revisionDraft.allVideos ? 'ALL_VIDEOS' : 'ITEM', reason: revisionDraft.reason, deadlineDate: revisionDraft.deadlineDate }) });
      setRevisionDraft(null);
      setMessage((response.created === 1 ? 'Nova versão aberta.' : response.created + ' novas versões abertas.') + ' Histórico anterior preservado.');
      await Promise.all([load(), onUpdated()]);
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : 'Não foi possível abrir a nova versão.'); }
    finally { setSaving(false); }
  };
  const save = async () => {
    if (!data || !dirtyCount || saving || loading) return;
    const deliveries = Object.values(drafts);
    const invalid = deliveries.find((item) => item.disposition === 'DELIVERED' && !item.evidenceDate || item.disposition === 'NOT_APPLICABLE' && (!item.justification || item.justification.trim().length < 3));
    if (invalid) { setError('Preencha a data do docente ou a justificativa obrigatória.'); return; }
    setSaving(true); setError(null); setMessage(null);
    try {
      await apiRequest('/api/operations/manual-deliveries', { method: 'POST', csrfToken, body: JSON.stringify({ snapshotId: data.meta.snapshotId, deliveries }) });
      setMessage(deliveries.length + ' item(ns) salvo(s). Indicadores atualizados.');
      await Promise.all([load(), onUpdated()]);
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : 'Não foi possível salvar os registros.'); }
    finally { setSaving(false); }
  };

  return <section className="manual-section" aria-labelledby="manual-title" aria-busy={loading || saving}>
    <div className="manual-summary">
      <h2 id="manual-title">Pacote de UAs e videoaulas</h2>
      <details className="manual-help"><summary>Como registrar?</summary><p>UA: envio do pacote completo. Vídeo: data da gravação, com uma videoaula a cada 10h de disciplina.</p><p>“Não aplicável” exige justificativa. Para substituir material, abra uma nova versão com motivo e novo prazo.</p></details>
    </div>
    <div className="manual-filters">
      <label className="search-field"><span>Buscar</span><div><Search size={17} aria-hidden="true" /><input disabled={filtersLocked} value={filters.query} onChange={(event) => patchFilter('query', event.target.value)} placeholder="Docente, disciplina ou item" /></div></label>
      <label><span>Disciplina</span><select disabled={filtersLocked} value={filters.courseId} onChange={(event) => patchFilter('courseId', event.target.value)}><option value="">Todas as disciplinas</option>{data?.filters.courses.map((course) => <option value={course.value} key={course.value}>{course.label}</option>)}</select></label>
      <label><span>Tipo</span><select disabled={filtersLocked} value={filters.requirementId} onChange={(event) => patchFilter('requirementId', event.target.value)}><option value="">UA e videoaulas</option><option value="unidades_aprendizagem">Pacote de UAs</option><option value="videos">Videoaulas</option></select></label>
      <label><span>Situação</span><select disabled={filtersLocked} value={filters.status} onChange={(event) => patchFilter('status', event.target.value)}><option value="">Todas</option><option value="PENDING">Pendentes</option><option value="DELIVERED_ON_TIME">Entregue no prazo</option><option value="DELIVERED_LATE">Entregue com atraso</option><option value="NOT_APPLICABLE">Não aplicável</option><option value="INHERITED_READY">Replicado no prazo</option></select></label>
    </div>
    <div className="manual-toolbar">
      <span id="manual-date-rule">Data do docente: envio das UAs ou gravação do vídeo.</span>
      <label><input type="checkbox" checked={showPublication} onChange={(event) => setShowPublication(event.target.checked)} /><span>Mostrar publicação (sem efeito na nota)</span></label>
      <label><span>Período</span><select disabled={filtersLocked} value={filters.period} onChange={(event) => patchFilter('period', event.target.value)}><option value="">Todos</option>{data?.filters.periods.map((period) => <option key={period}>{period}</option>)}</select></label>
    </div>
    {error && <div className="manual-feedback feedback-error" role="alert">{error}{!data ? <button type="button" onClick={() => void load()}>Tentar novamente</button> : <button type="button" disabled={saving || loading} onClick={() => { setRevisionDraft(null); setDrafts({}); void load(); }}>Descartar e recarregar</button>}</div>}
    {message && <div className="manual-feedback feedback-success" role="status">{message}</div>}
    {loading && !data ? <div className="manual-loading" role="status"><div className="skeleton-line" /><span>Carregando itens…</span></div> : data && <>
      <div className="manual-table-wrap" role="region" aria-label="Registros de UA e videoaulas; role para consultar todas as colunas" tabIndex={0}>
        <table className={'manual-table' + (showPublication ? ' has-publication' : '')}>
          <thead><tr><th>Disciplina e docente</th><th>Item</th><th>Prazo</th><th>Registro</th><th>Data do docente</th>{showPublication && <th>Publicação</th>}<th>Situação</th></tr></thead>
          <tbody>{data.items.map((item) => {
            const draft = current.get(item.id) || initialDraft(item);
            const evidenceLabel = item.requirement.evidenceType === 'SENT_BY_TEACHER' ? 'Data do envio' : 'Data da gravação';
            const recordLabel = item.requirement.label + ' de ' + item.teacher.name + ' em ' + item.course.name;
            const activeRevision = revisionDraft?.itemId === item.id ? revisionDraft : null;
            const showingHistory = expandedHistory === item.id;
            return <Fragment key={item.id}>
              <tr className={drafts[item.id] ? 'manual-row-dirty' : ''}>
                <td><strong>{item.course.name}</strong><small>{item.teacher.name} · {item.course.shortName}</small></td>
                <td><strong>{item.requirement.label}</strong><small>{evidenceLabel} · versão {item.version}</small></td>
                <td>{formatDate(item.deadlineAt, 'A validar')}{item.version > 1 && <small>Prazo desta versão</small>}</td>
                <td>{item.editable ? <select disabled={editingLocked} aria-label={'Registro de ' + recordLabel} value={draft.disposition} onChange={(event) => patchDraft(item, { disposition: event.target.value as ManualDeliveryDisposition })}><option value="PENDING">Pendente</option><option value="DELIVERED">Entregue</option><option value="NOT_APPLICABLE">Não aplicável</option></select> : <span className="locked-value">Replicado no prazo</span>}</td>
                <td>{item.editable && draft.disposition === 'DELIVERED'
                  ? <input disabled={editingLocked} aria-label={evidenceLabel + ' de ' + recordLabel} aria-describedby="manual-date-rule" type="date" value={draft.evidenceDate || ''} onChange={(event) => patchDraft(item, { evidenceDate: event.target.value || null })} />
                  : item.editable && draft.disposition === 'NOT_APPLICABLE'
                    ? <input disabled={editingLocked} aria-label={'Justificativa de ' + recordLabel} type="text" maxLength={500} value={draft.justification || ''} onChange={(event) => patchDraft(item, { justification: event.target.value })} placeholder="Justificativa obrigatória" />
                    : <span className="empty-value">—</span>}</td>
                {showPublication && <td>{item.editable && draft.disposition !== 'NOT_APPLICABLE' ? <input disabled={editingLocked} aria-label={'Publicação de ' + recordLabel + ' (sem efeito na nota)'} type="date" value={draft.publishedDate || ''} onChange={(event) => patchDraft(item, { publishedDate: event.target.value || null })} /> : <span className="empty-value">—</span>}</td>}
                <td><DelayLabel item={item} />
                  <div className="row-actions">
                    {item.canCreateRevision && <button type="button" disabled={filtersLocked || loading} onClick={() => { setExpandedHistory(null); setError(null); setRevisionDraft({ itemId: item.id, reason: '', deadlineDate: '', allVideos: false }); }}><RefreshCw size={14} aria-hidden="true" />{item.requirement.baseId === 'videos' ? 'Regravar' : 'Trocar pacote'}</button>}
                    {item.history.length > 1 && <button type="button" aria-expanded={showingHistory} onClick={() => setExpandedHistory(showingHistory ? null : item.id)}><History size={14} aria-hidden="true" />Histórico ({item.history.length})</button>}
                  </div>
                </td>
              </tr>
              {activeRevision && <tr className="revision-editor-row"><td colSpan={showPublication ? 7 : 6}><div className="revision-editor">
                <div><strong>{item.requirement.baseId === 'videos' ? 'Nova gravação' : 'Novo pacote de UAs'}</strong><span>A versão {item.version} continuará no histórico.</span></div>
                <label><span>Motivo da substituição</span><input autoFocus disabled={saving} type="text" maxLength={500} value={activeRevision.reason} onChange={(event) => setRevisionDraft({ ...activeRevision, reason: event.target.value })} placeholder="Ex.: atualização do conteúdo" /></label>
                <label><span>Novo prazo</span><input disabled={saving} type="date" value={activeRevision.deadlineDate} onChange={(event) => setRevisionDraft({ ...activeRevision, deadlineDate: event.target.value })} /></label>
                {item.requirement.baseId === 'videos' && <label className="revision-check"><input disabled={saving} type="checkbox" checked={activeRevision.allVideos} onChange={(event) => setRevisionDraft({ ...activeRevision, allVideos: event.target.checked })} /><span>Regravar todas as videoaulas desta disciplina</span></label>}
                <div className="revision-actions"><button className="secondary-button" type="button" disabled={saving} onClick={() => setRevisionDraft(null)}>Cancelar</button><button className="primary-button" type="button" disabled={saving} onClick={() => void createRevision(item)}><RefreshCw size={15} aria-hidden="true" />{saving ? 'Abrindo…' : 'Abrir nova versão'}</button></div>
              </div></td></tr>}
              {showingHistory && <tr className="history-row"><td colSpan={showPublication ? 7 : 6}><div className="version-history"><strong>Histórico preservado</strong><ol>{item.history.map((entry) => <li key={entry.version}><b>Versão {entry.version}</b><span>{historyLabel(entry.disposition)}</span>{entry.revisionDeadlineDate && <span>Prazo: {formatDate(entry.revisionDeadlineDate)}</span>}{entry.evidenceDate && <span>Docente: {formatDate(entry.evidenceDate)}</span>}{entry.replacementReason && <small>{entry.replacementReason}</small>}</li>)}</ol></div></td></tr>}
            </Fragment>;
          })}</tbody>
        </table>
      </div>
      {!data.items.length && <div className="empty-state"><strong>Nenhum item encontrado</strong><span>Altere os filtros para continuar.</span></div>}
      <div className="manual-footer">
        <nav className="pagination" aria-label="Paginação do controle manual"><button type="button" disabled={filters.page <= 1 || filtersLocked || loading} onClick={() => patchFilter('page', filters.page - 1)}><ChevronLeft size={16} />Anterior</button><span>Página {data.pagination.page} de {data.pagination.pages} · {data.pagination.total} itens</span><button type="button" disabled={filters.page >= data.pagination.pages || filtersLocked || loading} onClick={() => patchFilter('page', filters.page + 1)}>Próxima<ChevronRight size={16} /></button></nav>
        <div className="manual-actions">{Boolean(dirtyCount) && <button className="secondary-button" type="button" disabled={saving || loading} onClick={() => { setDrafts({}); setError(null); }}>Descartar</button>}<button className="primary-button" type="button" disabled={!dirtyCount || saving || loading || Boolean(revisionDraft)} onClick={() => void save()}><Save size={16} aria-hidden="true" />{saving ? 'Salvando…' : dirtyCount ? 'Salvar (' + dirtyCount + ')' : 'Sem alterações'}</button></div>
      </div>
    </>}
  </section>;
}
