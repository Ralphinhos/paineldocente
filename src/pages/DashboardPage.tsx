import { FileText, RefreshCw, ShieldAlert, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { apiRequest, toQueryString } from '@/api/client';
import { AppShell } from '@/components/layout/AppShell';
import { WorkspaceTabs } from '@/components/ui/WorkspaceTabs';
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { DataGuardBanner } from '@/components/dashboard/DataGuardBanner';
import { EvidenceDrawer } from '@/components/dashboard/EvidenceDrawer';
import { ExceptionTable } from '@/components/dashboard/ExceptionTable';
import { ExecutiveOverview } from '@/components/dashboard/ExecutiveOverview';
import type { ExecutiveVisualSelection } from '@/components/dashboard/ExecutiveCharts';
import { TeacherRanking } from '@/components/dashboard/TeacherRanking';
import { ManualDeliveryPanel } from '@/components/dashboard/ManualDeliveryPanel';
import { ReportPreviewDialog } from '@/components/dashboard/ReportPreviewDialog';
import { SummaryBar } from '@/components/dashboard/SummaryBar';
import { useAuth } from '@/contexts/auth';
import type { AssignmentRow, DashboardData, DashboardFilters as FilterState, RankingEntry } from '@/types/dashboard';
const EMPTY_FILTERS: FilterState = { period: '', modality: '', courseId: '', status: '', requirementGroup: '', query: '', page: 1 };
const formatGeneratedAt = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(value));

export function DashboardPage() {
  const { user, csrfToken } = useAuth();
  const executive = user?.role === 'executive';
  const ned = user?.role === 'ned_admin';
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [data, setData] = useState<DashboardData | null>(null);
  const [selected, setSelected] = useState<AssignmentRow | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<string | null>(null);
  const [selectedVisual, setSelectedVisual] = useState<string | null>(null);
  const [section, setSection] = useState(executive ? 'summary' : 'tracking');
  const [manualDirty, setManualDirty] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [manualRefreshKey, setManualRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError(null);
    try {
      const result = await apiRequest<DashboardData>('/api/dashboard' + toQueryString({ ...filters, pageSize: user?.role === 'executive' ? 50 : 20 }), { signal });
      if (!signal?.aborted) setData(result);
    } catch (caught) { if ((caught as Error).name !== 'AbortError') setError(caught instanceof Error ? caught.message : 'Não foi possível carregar os dados.'); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [filters, user?.role]);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => void load(controller.signal), filters.query ? 250 : 0);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [load, filters.query]);
  const refresh = async () => {
    setRefreshing(true); setError(null);
    try { await apiRequest('/api/operations/snapshots', { method: 'POST', csrfToken }); await load(); setManualRefreshKey((current) => current + 1); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível atualizar a coleta.'); }
    finally { setRefreshing(false); }
  };
  const chooseTeacher = (entry: RankingEntry) => {
    setSection('tracking'); setSelectedVisual(null); setSelectedTeacher(entry.teacher.name);
    setFilters((current) => ({ ...current, teacherId: entry.teacher.id, status: '', requirementGroup: '', page: 1 }));
  };
  const chooseVisual = (selection: ExecutiveVisualSelection) => {
    setSection('tracking'); setSelectedTeacher(null); setSelectedVisual(selection.label);
    setFilters((current) => ({ ...current, teacherId: '', status: selection.status, requirementGroup: selection.requirementGroup || '', page: 1 }));
  };
  const patchFilters = (next: FilterState) => {
    if (!next.teacherId) setSelectedTeacher(null);
    if (next.status !== filters.status || next.requirementGroup !== filters.requirementGroup) setSelectedVisual(null);
    setFilters(next);
  };
  const clearSelection = () => {
    setSelectedTeacher(null); setSelectedVisual(null);
    setFilters((current) => ({ ...current, teacherId: '', status: '', requirementGroup: '', page: 1 }));
    if (executive) setSection('summary');
  };
  const tabs = ned ? [{ id: 'tracking', label: 'Conferência' }, { id: 'manual', label: 'UA e vídeos' }, { id: 'reports', label: 'Relatórios', count: data?.meta.qualityIssues.filter((item) => item.severity === 'CRITICAL').length }] : executive ? [{ id: 'summary', label: 'Resumo da gestão' }, { id: 'tracking', label: 'Consultar disciplinas' }] : [{ id: 'tracking', label: 'Disciplinas' }];
  return <AppShell hasUnsavedChanges={manualDirty}>
    <div className="page-header"><div><span className="eyebrow">Acompanhamento semanal</span><h1>{executive ? 'Resumo docente' : user?.role === 'coordinator' ? 'Minhas disciplinas' : 'Entregas e acessos'}</h1>{data && <p>{data.summary.courses} disciplinas · {data.summary.monitoredTeachers} docentes <span className="header-reference">Dados de {formatGeneratedAt(data.meta.generatedAt)}{loading ? ' · atualizando…' : ''}</span></p>}</div><div className="header-actions">{ned && <button className="secondary-button" type="button" disabled={refreshing || manualDirty || loading} onClick={() => void refresh()}><RefreshCw size={16} className={refreshing ? 'spin' : ''} />{refreshing ? 'Atualizando…' : 'Atualizar dados'}</button>}<button className="primary-button" type="button" disabled={!data || manualDirty} onClick={() => ned ? setSection('reports') : setReportOpen(true)}><FileText size={16} />{ned ? 'Preparar relatórios' : 'Ver relatório'}</button></div></div>
    {error && <div className="page-error" role="alert"><ShieldAlert size={18} /><span>{error}{data && ' Os dados anteriores permanecem visíveis.'}</span><button type="button" onClick={() => void load()}>Tentar novamente</button></div>}
    {loading && !data ? <div className="dashboard-skeleton" role="status" aria-label="Carregando entregas e acessos"><div /><div /><div /><span className="sr-only">Carregando dados…</span></div> : data && <>
      <DataGuardBanner meta={data.meta} />
      <WorkspaceTabs id="workspace" label="Áreas do acompanhamento" tabs={tabs} value={section} onChange={setSection} locked={manualDirty} />
      <section id="workspace-panel-tracking" role="tabpanel" aria-labelledby="workspace-tab-tracking" hidden={section !== 'tracking'} aria-busy={loading}>
        <DashboardFilters value={filters} options={data.filters} onChange={patchFilters} />
        {(selectedTeacher || selectedVisual) && <div className="selected-filter"><span>{selectedTeacher ? 'Docente: ' : 'Situação: '}<strong>{selectedTeacher || selectedVisual}</strong></span><button className="text-action" type="button" onClick={clearSelection}><X size={15} />{executive ? 'Voltar ao resumo' : 'Limpar seleção'}</button></div>}
        <SummaryBar summary={data.summary} onSelect={chooseVisual} />
        <ExceptionTable data={data} filters={filters} onFilters={patchFilters} onOpen={setSelected} />
        {!executive && !selectedTeacher && <details className="secondary-analysis"><summary>Consultar ranking docente</summary><TeacherRanking data={data.ranking} onSelect={chooseTeacher} /></details>}
        <details className="criteria-help"><summary>Critérios de entrega e acesso</summary><div className="criteria-grid"><div><h3>Entregas</h3><p>Antes do prazo: antecipada. Na data limite: no prazo. Depois: entregue com atraso.</p><p>Sem entrega: pendente no prazo ou em atraso. O atraso acumula até a entrega e fica fixo depois.</p><p>Material replicado e conferido: pronto no prazo. Não aplicável: dispensa justificada. A validar: evidência incompleta.</p></div><div><h3>Acessos e registro manual</h3><p>0–7 dias em dia; 8–14 atenção; 15+ crítico. Ausência de registro aparece separadamente.</p><p>UA: envio do pacote completo. Vídeo: data da gravação. Publicação não altera a nota.</p><p>Semestral mantém as avaliações do 1º e 2º bimestre. Substitutiva fica fora dos indicadores.</p></div></div></details>
      </section>
      {executive && <section id="workspace-panel-summary" role="tabpanel" aria-labelledby="workspace-tab-summary" hidden={section !== 'summary'} aria-busy={loading}><DashboardFilters value={filters} options={data.filters} onChange={patchFilters} showStatus={false} /><SummaryBar summary={data.summary} onSelect={chooseVisual} /><ExecutiveOverview data={data} onTeacher={chooseTeacher} onVisual={chooseVisual} /></section>}
      {ned && <section id="workspace-panel-manual" role="tabpanel" aria-labelledby="workspace-tab-manual" hidden={section !== 'manual'}><ManualDeliveryPanel active={section === 'manual'} refreshKey={manualRefreshKey} onDirtyChange={setManualDirty} onUpdated={load} /></section>}
      {ned && <section id="workspace-panel-reports" role="tabpanel" aria-labelledby="workspace-tab-reports" hidden={section !== 'reports'}><ReportPreviewDialog open={section === 'reports'} inline onClose={() => setSection('tracking')} /><details className="quality-details"><summary>Validação dos dados · {data.meta.qualityIssues.length} ocorrência(s)</summary><section className="quality-section"><p>{data.meta.publishAllowed ? 'Coleta liberada para envio.' : 'Envio bloqueado até validar dados, prazos e destinatários.'}</p>{data.meta.qualityIssues.length ? <ul>{data.meta.qualityIssues.map((issue, index) => <li key={issue.code + '-' + index}><span className={'quality-dot dot-' + issue.severity.toLowerCase()} aria-hidden="true" /><span>{issue.message}</span></li>)}</ul> : <p>Nenhuma ocorrência de qualidade identificada.</p>}<details className="source-details"><summary>Detalhes da coleta</summary><p>Referência {data.meta.snapshotId} · regras {data.meta.rulesVersion} · {data.meta.source === 'demo' ? 'Dados fictícios' : 'Moodle'}</p></details></section></details></section>}
      <EvidenceDrawer row={selected} onClose={() => setSelected(null)} />
      {!ned && <ReportPreviewDialog open={reportOpen} onClose={() => setReportOpen(false)} />}
    </>}
  </AppShell>;
}
