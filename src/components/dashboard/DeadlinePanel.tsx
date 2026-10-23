import { CalendarDays, Check, ChevronLeft, ChevronRight, History, RotateCcw, Save } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest, toQueryString } from '@/api/client';
import { useAuth } from '@/contexts/auth';
import { formatDate } from '@/lib/presentation';
import type { DeadlineInput, DeadlineReview, DeadlineView } from '@/types/deadlines';

const dateList = (dates: string[]) => dates.length ? dates.map((date, index) => (dates.length > 1 ? `${index + 1}: ` : '') + formatDate(date)).join(' · ') : 'Sem prazo cadastrado';

export function AcademicCalendarSelector({ groups, value, bimester, semestral, disabled, onGroup, onBimester }: {
  groups: Array<{ value: string; label: string }>; value: string; bimester: string; semestral: boolean; disabled: boolean;
  onGroup: (value: string) => void; onBimester: (value: string) => void;
}) {
  return <div className="deadline-calendar-selector"><div className="deadline-group-buttons" aria-label={semestral ? 'Modelo semestral' : 'Módulo acadêmico'}>{groups.map((group, index) => <button type="button" key={group.value} disabled={disabled} aria-pressed={value === group.value} className={'deadline-group-button deadline-group-' + index + (value === group.value ? ' is-selected' : '')} onClick={() => onGroup(group.value)}><CalendarDays size={18} aria-hidden="true" /><strong>{group.label}</strong></button>)}</div>
    {semestral && value && <label className="deadline-bimester"><span>Bimestre</span><select value={bimester} disabled={disabled} onChange={(event) => onBimester(event.target.value)}><option value="1">1º bimestre</option><option value="2">2º bimestre</option></select></label>}</div>;
}

export function DeadlinePanel({ active, refreshKey, onDirtyChange, onUpdated }: { active: boolean; refreshKey: number; onDirtyChange: (value: boolean) => void; onUpdated: () => Promise<void> }) {
  const { csrfToken } = useAuth();
  const [filters, setFilters] = useState({ period: '', modality: 'GRADUACAO_EAD', calendarGroup: '', bimester: '1', courseId: '' });
  const [addedCourses, setAddedCourses] = useState<string[]>([]);
  const [data, setData] = useState<DeadlineView | null>(null);
  const [edits, setEdits] = useState<Record<string, string[]>>({});
  const [reason, setReason] = useState('');
  const [individualVideos, setIndividualVideos] = useState(false);
  const [review, setReview] = useState<{ input: DeadlineInput; result: DeadlineReview } | null>(null);
  const [reviewPage, setReviewPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const changed = Object.keys(edits).length > 0 || addedCourses.length > 0 || Boolean(reason.trim()) || Boolean(review);
  const locked = changed || saving;
  useEffect(() => { onDirtyChange(locked); }, [locked, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  useEffect(() => { if (review) reviewHeading.current?.focus(); }, [review]);
  useEffect(() => {
    if (!locked) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [locked]);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError(null);
    try {
      const response = await apiRequest<DeadlineView>('/api/operations/deadlines' + toQueryString({ ...filters, bimester: filters.modality === 'SEMESTRAL' && filters.calendarGroup ? filters.bimester : '' }), { signal });
      if (!signal?.aborted) {
        setData(response); setEdits({}); setAddedCourses([]); setReason(''); setReview(null);
        const videoDates = response.requirements.find((row) => row.id === 'videos')?.dates || [];
        setIndividualVideos(Boolean(filters.courseId && videoDates.length > 1));
      }
    } catch (caught) { if ((caught as Error).name !== 'AbortError') setError(caught instanceof Error ? caught.message : 'Não foi possível carregar os prazos.'); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [filters]);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [active, load, refreshKey]);
  const patchFilter = (key: keyof typeof filters, value: string) => {
    if (locked) return;
    setLoading(true); setMessage(null);
    setFilters((current) => ({ ...current, [key]: value, ...(key !== 'courseId' ? { courseId: '' } : {}), ...(key === 'modality' ? { calendarGroup: '', bimester: '1' } : {}) }));
  };
  const patch = (id: string, dates: string[]) => { setEdits((current) => ({ ...current, [id]: dates })); setReview(null); setMessage(null); setError(null); };
  const changes = Object.entries(edits).map(([requirementId, dates]) => ({ requirementId, dates }));
  const selectableCourses = data?.filters.courses.filter((course) => course.period === filters.period && course.modality === filters.modality) || [];
  const scope = [...new Map([...(data?.scope || []), ...selectableCourses.filter((course) => addedCourses.includes(course.id))].map((course) => [course.id, course])).values()];
  const assignmentChanged = scope.some((course) => selectableCourses.find((candidate) => candidate.id === course.id)?.calendarGroup !== filters.calendarGroup);
  const canReview = Boolean(data && filters.period && filters.calendarGroup && scope.length > 0 && scope.length <= 1000 && (changes.length || assignmentChanged) && changes.every((change) => change.dates.every(Boolean)) && reason.trim().length >= 3 && !loading && !saving);
  const preview = async () => {
    if (!data || !canReview) return;
    const input: DeadlineInput = { snapshotId: data.meta.snapshotId, expectedVersionId: data.meta.version?.id || null, period: filters.period, modality: filters.modality, calendarGroup: filters.calendarGroup,
      ...(filters.modality === 'SEMESTRAL' ? { bimester: filters.bimester } : {}), courseIds: scope.map((row) => row.id), changes, reason: reason.trim() };
    setSaving(true); setError(null); setMessage(null);
    try { const result = await apiRequest<DeadlineReview>('/api/operations/deadlines/preview', { method: 'POST', csrfToken, body: JSON.stringify(input) }); setReview({ input, result }); setReviewPage(1); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível conferir as datas.'); }
    finally { setSaving(false); }
  };
  const save = async () => {
    if (!review || saving) return;
    setSaving(true); setError(null);
    try {
      const result = await apiRequest<{ message: string }>('/api/operations/deadlines', { method: 'POST', csrfToken, body: JSON.stringify({ ...review.input, reviewToken: review.result.reviewToken }) });
      setMessage(result.message);
      await Promise.all([load(), onUpdated()]);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível salvar os prazos.'); }
    finally { setSaving(false); }
  };
  const video = data?.requirements.find((item) => item.id === 'videos');
  const groupLabel = data?.filters.calendarGroups.find((group) => group.value === filters.calendarGroup)?.label || '';
  const unassignedCourses = selectableCourses.filter((course) => !course.calendarGroup);
  const reviewPages = review ? Math.ceil(review.result.impact.length / 20) : 1;
  return <section className="ned-panel deadline-panel" aria-labelledby="deadline-title" aria-busy={loading || saving}>
    <header className="ned-panel-heading"><div><h2 id="deadline-title"><CalendarDays size={18} aria-hidden="true" />Prazos definidos pelo NED</h2><p>Cadastre as datas, confira as disciplinas afetadas e salve.</p></div>{data?.meta.version && <span>Versão {data.meta.version.revision} · {formatDate(data.meta.version.createdAt)}</span>}</header>
    <div className="deadline-filters">
      <label><span>Semestre</span><select value={filters.period} disabled={locked || loading} onChange={(event) => patchFilter('period', event.target.value)}><option value="">Selecione o semestre</option>{data?.filters.periods.map((period) => <option key={period}>{period}</option>)}</select></label>
      <label><span>Modalidade</span><select value={filters.modality} disabled={locked || loading} onChange={(event) => patchFilter('modality', event.target.value)}>{(data?.filters.modalities || [{ value: 'GRADUACAO_EAD', label: 'Graduação EaD' }]).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label><span>Disciplina · exceção individual</span><select value={filters.courseId} disabled={locked || loading || !filters.period || !filters.calendarGroup} onChange={(event) => patchFilter('courseId', event.target.value)}><option value="">Todas vinculadas a {groupLabel || 'este calendário'}</option>{selectableCourses.map((course) => <option key={course.id} value={course.id}>{course.name} · {course.shortName} · {course.calendarGroup || 'Sem classificação'}</option>)}</select></label>
    </div>
    {filters.period && <AcademicCalendarSelector groups={data?.filters.calendarGroups || []} value={filters.calendarGroup} bimester={filters.bimester} semestral={filters.modality === 'SEMESTRAL'} disabled={locked || loading} onGroup={(value) => patchFilter('calendarGroup', value)} onBimester={(value) => patchFilter('bimester', value)} />}
    {error && <div className="manual-feedback feedback-error" role="alert">{error}<button type="button" disabled={saving || loading} onClick={() => void load()}>Descartar e recarregar</button></div>}
    {message && <div className="manual-feedback feedback-success" role="status">{message}</div>}
    {data?.meta.pendingCollection && <p className="deadline-pending" role="status">Há prazos salvos que ainda não entraram na coleta. Use Atualizar dados antes de preparar relatórios.</p>}
    {data && filters.period && filters.calendarGroup && !filters.courseId && unassignedCourses.length > 0 && <details className="deadline-bindings" open={data.scope.length === 0 || undefined}><summary>Vincular disciplinas a {groupLabel} · {unassignedCourses.length} sem classificação</summary><p>Selecione somente as disciplinas deste módulo ou modelo.</p><div className="deadline-course-checklist">{unassignedCourses.map((course) => <label key={course.id}><input type="checkbox" checked={addedCourses.includes(course.id)} disabled={loading || saving} onChange={(event) => { const checked = event.target.checked; setAddedCourses((current) => checked ? [...current, course.id] : current.filter((id) => id !== course.id)); setReview(null); }} /><span>{course.name}<small>{course.shortName}</small></span></label>)}</div></details>}
    {!data && loading ? <div className="manual-loading" role="status">Carregando prazos…</div> : !filters.period || !filters.calendarGroup ? <div className="ned-chart-empty"><strong>{!filters.period ? 'Selecione o semestre para começar' : 'Selecione o módulo ou modelo acima'}</strong><span>Cada calendário mantém suas próprias datas e disciplinas.</span></div> : data && scope.length ? <>
      <div className="deadline-context-heading"><h3>{groupLabel}{filters.modality === 'SEMESTRAL' && ' · ' + filters.bimester + 'º bimestre'}</h3>{Object.keys(data.referenceDates).length > 0 && <button className="secondary-button" type="button" disabled={loading || saving} onClick={() => { setEdits((current) => ({ ...current, ...Object.fromEntries(data.requirements.filter((item) => data.referenceDates[item.id]).map((item) => [item.id, [data.referenceDates[item.id]]])) })); setReason((current) => current || 'Calendário 2026/2 conforme os prints do NED.'); setReview(null); setMessage(null); }}>Usar datas dos prints · 2026/2</button>}</div>
      <p className="deadline-scope"><strong>{scope.length} disciplina(s)</strong> selecionada(s). Confira os vínculos e as datas antes de salvar.</p>
      {scope.length > 1000 && <p className="deadline-pending">Recorte acima de 1.000 disciplinas. Selecione uma disciplina para ajustar o prazo.</p>}
      <div className="deadline-fields">{data.requirements.map((item, position) => {
        const individual = item.id === 'videos' && individualVideos && Boolean(item.individualCount);
        const dates = edits[item.id] || (individual ? Array.from({ length: item.individualCount || 0 }, (_, index) => item.dates[index] || item.dates[0] || '') : [item.dates.length === 1 ? item.dates[0] : '']);
        return <div key={item.id}>{item.agendaOnly && !data.requirements[position - 1]?.agendaOnly && <div className="deadline-agenda-heading"><h4>Outras datas da agenda</h4><p>Datas informativas. Não entram nos indicadores de entrega nem no ranking docente.</p></div>}<div className="deadline-field">
          <div><strong>{item.label}</strong>{item.id === 'videos' && <small>Prazo para o docente gravar.</small>}{item.id === 'unidades_aprendizagem' && <small>Prazo para envio do pacote completo.</small>}{(item.mixed || !individual && item.dates.length > 1) && <small>Há datas diferentes neste recorte. Uma data comum substituirá esses prazos.</small>}</div>
          <div className={'deadline-date-inputs' + (individual ? ' deadline-individual' : '')}>{dates.map((date, index) => <label key={index}><span>{individual ? 'Videoaula ' + (index + 1) : 'Data limite'}</span><input type="date" aria-label={individual ? 'Prazo da videoaula ' + (index + 1) : 'Prazo de ' + item.label} disabled={loading || saving} value={date} onChange={(event) => patch(item.id, dates.map((value, position) => position === index ? event.target.value : value))} /></label>)}</div>
        </div></div>;
      })}</div>
      {video && <label className="deadline-video-toggle"><input type="checkbox" checked={individualVideos} disabled={!filters.courseId || !video.individualCount || loading || saving} onChange={(event) => {
        const checked = event.target.checked; setIndividualVideos(checked);
        const current = edits.videos || video.dates;
        patch('videos', checked ? Array.from({ length: video.individualCount || 0 }, (_, index) => current[index] || current[0] || '') : [current[0] || '']);
      }} /><span>Definir um prazo para cada videoaula <small>(selecione uma disciplina)</small></span></label>}
      <div className="deadline-reason"><label><span>Motivo da alteração</span><textarea rows={2} maxLength={500} disabled={loading || saving} value={reason} onChange={(event) => { setReason(event.target.value); setReview(null); }} placeholder="Ex.: calendário aprovado pelo NED para o módulo." /></label><p>Novas versões de UA e vídeo mantêm o prazo próprio registrado na troca de material.</p></div>
      <div className="deadline-actions"><button className="secondary-button" type="button" disabled={!changed || saving} onClick={() => void load()}><RotateCcw size={16} />Descartar alterações</button><button className="primary-button" type="button" disabled={!canReview} onClick={() => void preview()}><Check size={16} />{saving && !review ? 'Conferindo…' : 'Revisar alterações'}</button></div>
      {review && <section className="deadline-review" aria-labelledby="deadline-review-title"><h3 ref={reviewHeading} tabIndex={-1} id="deadline-review-title">Confira antes de salvar</h3><p>{review.result.courseCount} disciplina(s) · {review.result.changeCount} alteração(ões). Uma nova coleta será gerada; relatórios já enviados permanecem preservados.</p>
        <div className="monitoring-table-wrap"><table className="monitoring-table deadline-review-table"><thead><tr><th scope="col">Disciplina</th><th scope="col">Atividade / vínculo</th><th scope="col">Antes</th><th scope="col">Novo valor</th></tr></thead><tbody>{review.result.impact.slice((reviewPage - 1) * 20, reviewPage * 20).map((row) => <tr key={row.courseId + row.requirementId}><td>{row.courseName}<small>{row.shortName}</small></td><td>{row.label}{row.hasOwnRevisionDeadline && <small>Nova versão mantém prazo próprio.</small>}</td><td>{row.kind === 'GROUP' ? row.before.join(', ') : dateList(row.before)}</td><td>{row.kind === 'GROUP' ? row.after.join(', ') : dateList(row.after)}</td></tr>)}</tbody></table></div>
        {reviewPages > 1 && <div className="monitoring-pagination"><span>Conferência {reviewPage} de {reviewPages}</span><div><button className="secondary-button" type="button" disabled={reviewPage === 1 || saving} onClick={() => setReviewPage((page) => page - 1)} aria-label="Alterações anteriores"><ChevronLeft size={15} /></button><button className="secondary-button" type="button" disabled={reviewPage === reviewPages || saving} onClick={() => setReviewPage((page) => page + 1)} aria-label="Próximas alterações"><ChevronRight size={15} /></button></div></div>}
        <div className="deadline-actions"><button className="secondary-button" type="button" disabled={saving} onClick={() => setReview(null)}>Voltar à edição</button><button className="primary-button" type="button" disabled={saving} onClick={() => void save()}><Save size={16} />{saving ? 'Salvando…' : 'Confirmar e salvar prazos'}</button></div>
      </section>}
    </> : <div className="ned-chart-empty"><strong>Nenhuma disciplina vinculada a este calendário</strong><span>Vincule as disciplinas acima ou selecione uma disciplina individual.</span>{changed && <button className="secondary-button" type="button" disabled={saving || loading} onClick={() => void load()}>Descartar alterações</button>}</div>}
    {data && <details className="deadline-history"><summary><History size={16} aria-hidden="true" />Histórico de alterações{data.history.length > 0 && ' · últimas ' + data.history.length}</summary>{data.history.length ? <ol>{data.history.map((item) => <li key={item.id}><strong>Versão {item.revision} · {formatDate(item.createdAt)}</strong><span>{item.createdBy} · {item.courseCount} disciplina(s) · {item.changeCount} alteração(ões)</span><p>{item.reason}</p></li>)}</ol> : <p>Nenhuma alteração salva pelo NED. Os prazos existentes estão disponíveis para conferência.</p>}</details>}
  </section>;
}
