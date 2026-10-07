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
import { ManualDeliveryPanel } from '@/components/dashboard/ManualDeliveryPanel';
import { ReportPreviewDialog } from '@/components/dashboard/ReportPreviewDialog';
import { SummaryBar } from '@/components/dashboard/SummaryBar';
import { useAuth } from '@/contexts/auth';
import type { AssignmentRow, DashboardData, DashboardFilters as FilterState, RankingEntry, VisualSelection } from '@/types/dashboard';
const EMPTY_FILTERS: FilterState = { period: '', modality: '', courseId: '', status: '', requirementGroup: '', requirementId: '', query: '', page: 1 };
const formatGeneratedAt = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(value));

export function DashboardPage() {
  const { user, csrfToken } = useAuth();
  const ned = user?.role === 'ned_admin';
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [data, setData] = useState<DashboardData | null>(null);
  const [selected, setSelected] = useState<AssignmentRow | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<string | null>(null);
  const [selectedVisual, setSelectedVisual] = useState<string | null>(null);
  const [section, setSection] = useState('summary');
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
    setFilters((current) => ({ ...current, teacherId: entry.teacher.id, status: '', requirementGroup: '', requirementId: '', page: 1 }));
  };
  const chooseVisual = (selection: VisualSelection) => {
    setSection('tracking'); setSelectedTeacher(null); setSelectedVisual(selection.label);
    setFilters((current) => ({ ...current, teacherId: '', status: selection.status, requirementGroup: selection.requirementGroup || '', requirementId: selection.requirementId || '', modality: selection.modality || current.modality, page: 1 }));
  };
  const patchFilters = (next: FilterState) => {
    if (!next.teacherId) setSelectedTeacher(null);
    if (next.status !== filters.status || next.requirementGroup !== filters.requirementGroup || next.requirementId !== filters.requirementId) setSelectedVisual(null);
    setFilters(next);
  };
  const clearSelection = () => {
    setSelectedTeacher(null); setSelectedVisual(null);
    setFilters((current) => ({ ...current, teacherId: '', status: '', requirementGroup: '', requirementId: '', page: 1 }));
  };
  const changeSection = (next: string) => {
    if (next === 'summary') clearSelection();
    setSection(next);
  };
  const tabs = [
    { id: 'summary', label: 'Panorama', icon: 'chart' as const },
    { id: 'tracking', label: 'Planilha de controle', icon: 'table' as const },
    ...(ned ? [{ id: 'manual', label: 'UA e videoaulas', icon: 'edit' as const }, { id: 'reports', label: 'Relatórios e e-mails', icon: 'mail' as const }] : []),
  ];
  return <AppShell hasUnsavedChanges={manualDirty}>
    <div className="page-header"><div><h1>Análise de Risco e Desempenho Docente</h1>{data && <p>{user?.role === 'coordinator' ? 'Minhas disciplinas · ' : ''}Relatório de {formatGeneratedAt(data.meta.generatedAt)}{loading ? ' · atualizando…' : ''}</p>}</div><div className="header-actions">{ned && <button className="secondary-button" type="button" disabled={refreshing || manualDirty || loading} onClick={() => void refresh()}><RefreshCw size={16} className={refreshing ? 'spin' : ''} />{refreshing ? 'Atualizando…' : 'Atualizar dados'}</button>}<button className="primary-button" type="button" disabled={!data || manualDirty} onClick={() => ned ? setSection('reports') : setReportOpen(true)}><FileText size={16} />{ned ? 'Preparar e-mails' : 'Ver relatório'}</button></div></div>
    {error && <div className="page-error" role="alert"><ShieldAlert size={18} /><span>{error}{data && ' Os dados anteriores permanecem visíveis.'}</span><button type="button" onClick={() => void load()}>Tentar novamente</button></div>}
    {loading && !data ? <div className="dashboard-skeleton" role="status" aria-label="Carregando relatório docente"><div /><div /><div /><span className="sr-only">Carregando dados…</span></div> : data && <>
      <DataGuardBanner meta={data.meta} />
      <WorkspaceTabs id="workspace" label="Áreas do acompanhamento" tabs={tabs} value={section} onChange={changeSection} locked={manualDirty} />
      {(section === 'summary' || section === 'tracking') && <DashboardFilters value={filters} options={data.filters} onChange={patchFilters} showStatus={section === 'tracking'} />}
      {(selectedTeacher || selectedVisual) && section === 'tracking' && <div className="selected-filter"><span>{selectedTeacher ? 'Docente: ' : 'Atividades: '}<strong>{selectedTeacher || selectedVisual}</strong></span><button className="text-action" type="button" onClick={clearSelection}><X size={15} />Limpar seleção</button></div>}
      <section id="workspace-panel-summary" role="tabpanel" aria-labelledby="workspace-tab-summary" hidden={section !== 'summary'} aria-busy={loading}>
        <SummaryBar summary={data.summary} onSelect={chooseVisual} />
        <ExecutiveOverview data={data} onTeacher={chooseTeacher} onVisual={chooseVisual} />
      </section>
      <section id="workspace-panel-tracking" role="tabpanel" aria-labelledby="workspace-tab-tracking" hidden={section !== 'tracking'} aria-busy={loading}>
        <ExceptionTable data={data} filters={filters} onFilters={patchFilters} onOpen={setSelected} />
      </section>
      {(section === 'summary' || section === 'tracking') && <details className="criteria-help"><summary>Consultar critérios de entrega e acesso</summary><div className="criteria-grid"><div><h3>Entregas</h3><p>Antecipada ou no prazo: entregue até a data limite. Entregue com atraso: mostra a duração exata, quando comprovada.</p><p>Pendente vencida acumula atraso até entregar. Replicada e conferida: pronta no prazo. Não aplicável: dispensa justificada. A validar: evidência incompleta.</p></div><div><h3>Acesso e materiais</h3><p>0–7 dias em dia · 8–14 atenção · 15+ crítico. Sem registro aparece identificado.</p><p>UA: envio do pacote completo. Vídeo: gravação, uma aula por 10h. Publicação não altera a nota.</p><p>1º e 2º bimestre separados. Substitutiva fora dos indicadores.</p></div></div></details>}
      {ned && <section id="workspace-panel-manual" role="tabpanel" aria-labelledby="workspace-tab-manual" hidden={section !== 'manual'}><ManualDeliveryPanel active={section === 'manual'} refreshKey={manualRefreshKey} onDirtyChange={setManualDirty} onUpdated={load} /></section>}
      {ned && <section id="workspace-panel-reports" role="tabpanel" aria-labelledby="workspace-tab-reports" hidden={section !== 'reports'}><ReportPreviewDialog open={section === 'reports'} inline onClose={() => setSection('summary')} /><details className="quality-details"><summary>Validação dos dados · {data.meta.qualityIssues.length} ocorrência(s)</summary><section className="quality-section"><p>{data.meta.publishAllowed ? 'Coleta liberada para envio.' : 'Envio bloqueado até validar dados, prazos e destinatários.'}</p>{data.meta.qualityIssues.length ? <ul>{data.meta.qualityIssues.map((issue, index) => <li key={issue.code + '-' + index}><span className={'quality-dot dot-' + issue.severity.toLowerCase()} aria-hidden="true" /><span>{issue.message}</span></li>)}</ul> : <p>Nenhuma ocorrência de qualidade identificada.</p>}<details className="source-details"><summary>Detalhes da coleta</summary><p>Referência {data.meta.snapshotId} · regras {data.meta.rulesVersion} · {data.meta.source === 'demo' ? 'Dados fictícios' : 'Moodle'}</p></details></section></details></section>}
      <EvidenceDrawer row={selected} onClose={() => setSelected(null)} />
      {!ned && <ReportPreviewDialog open={reportOpen} onClose={() => setReportOpen(false)} />}
    </>}
  </AppShell>;
}
