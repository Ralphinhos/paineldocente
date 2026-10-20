import { ArrowLeft, CalendarDays, RefreshCw, Send, ShieldAlert } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { apiRequest, toQueryString } from '@/api/client';
import { AppShell } from '@/components/layout/AppShell';
import { WorkspaceTabs } from '@/components/ui/WorkspaceTabs';
import { AccessOverview } from '@/components/dashboard/AccessOverview';
import { DeliveryOverview } from '@/components/dashboard/DeliveryOverview';
import { DeliveryDetails } from '@/components/dashboard/DeliveryDetails';
import { MonitoringFilters } from '@/components/dashboard/MonitoringFilters';
import { ManualDeliveryPanel } from '@/components/dashboard/ManualDeliveryPanel';
import { DeadlinePanel } from '@/components/dashboard/DeadlinePanel';
import { DataGuardBanner } from '@/components/dashboard/DataGuardBanner';
import { ReportPreviewDialog } from '@/components/dashboard/ReportPreviewDialog';
import { initialDetailFilters } from '@/lib/workspace';
import { formatDate } from '@/lib/presentation';
import { useAuth } from '@/contexts/auth';
import type { DeliveryRecord, MonitoringData, MonitoringFilters as Filters } from '@/types/monitoring';

const formatGeneratedAt = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(value));

export function DashboardPage() {
  const { user, csrfToken } = useAuth();
  const ned = user?.role === 'ned_admin';
  const [filters, setFilters] = useState<Filters>(() => initialDetailFilters(typeof window === 'undefined' ? '' : window.location.search));
  const readOnly = !ned || Boolean(filters.snapshotId);
  const [data, setData] = useState<MonitoringData | null>(null);
  const [section, setSection] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('section') === 'deliveries' ? 'deliveries' : 'access');
  const [selected, setSelected] = useState<DeliveryRecord | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualDirty, setManualDirty] = useState(false);
  const [deadlineDirty, setDeadlineDirty] = useState(false);
  const unsavedChanges = manualDirty || deadlineDirty;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [manualRefreshKey, setManualRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!user) return;
    setLoading(true); setError(null);
    try {
      const result = await apiRequest<MonitoringData>('/api/monitoring' + toQueryString({ ...filters, pageSize: 20 }), { signal });
      if (!signal?.aborted) setData(result);
    } catch (caught) {
      if ((caught as Error).name !== 'AbortError') setError(caught instanceof Error ? caught.message : 'Não foi possível carregar os dados.');
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [filters, user]);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true); setError(null);
    try {
      if (!readOnly) await apiRequest('/api/operations/snapshots', { method: 'POST', csrfToken });
      await load(); setManualRefreshKey((current) => current + 1);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível atualizar a coleta.'); }
    finally { setRefreshing(false); }
  };
  const chooseTeacher = (teacherId: string) => setFilters((current) => ({ ...current, teacherId, accessStatus: 'ALL', activityKey: '', page: 1 }));
  const seeDeliveries = (teacherId: string) => {
    setSection('deliveries'); setManualOpen(false);
    setFilters((current) => ({ ...current, teacherId, deliveryStatus: 'OVERDUE', activityKey: '', page: 1 }));
  };
  const changeSection = (next: string) => {
    if (unsavedChanges || readOnly && !['access', 'deliveries'].includes(next)) return;
    setSection(next); setManualOpen(false); setFilters((current) => ({ ...current, page: 1 }));
  };
  const openManual = (row?: DeliveryRecord) => {
    if (readOnly) return;
    if (row) setFilters((current) => ({ ...current, teacherId: row.teacher.id, courseId: row.course.id, page: 1 }));
    setManualOpen(true);
  };
  const disabled = loading || refreshing || unsavedChanges;

  return <AppShell hasUnsavedChanges={unsavedChanges} header={<><div className="ned-page-heading"><h1>{readOnly ? 'Detalhamento Docente' : 'Monitoramento Docente'}</h1><p>{readOnly ? 'Consulta dos dados e evidências do semestre' : 'Área de trabalho do NED'}</p></div><div className="ned-header-actions"><span className="ned-collection-date" title={data ? 'Coleta de ' + formatGeneratedAt(data.meta.generatedAt) : undefined}><CalendarDays size={17} />{data ? 'Coleta: ' + formatDate(data.meta.generatedAt) : 'Carregando coleta…'}{loading && data && <span className="sr-only">Atualizando dados</span>}</span><button className="secondary-button" type="button" disabled={disabled} onClick={() => void refresh()}><RefreshCw size={16} className={refreshing ? 'spin' : ''} />{refreshing ? 'Atualizando…' : readOnly ? 'Recarregar consulta' : 'Atualizar dados'}</button>{!readOnly && <button className="primary-button" type="button" disabled={!data || disabled || manualOpen} onClick={() => changeSection('reports')}><Send size={16} />Preparar notificação</button>}</div></>}>
    {error && <div className="page-error" role="alert"><ShieldAlert size={18} /><span>{error}{data && ' A coleta anterior permanece visível.'}</span><button type="button" onClick={() => void load()}>Tentar novamente</button></div>}
    {!data && loading ? <div className="dashboard-skeleton" role="status" aria-label="Carregando acompanhamento docente"><div /><div /><div /><span className="sr-only">Carregando dados…</span></div> : data && <>
      {!readOnly ? <DataGuardBanner meta={data.meta} /> : <div className="guard-banner guard-demo" role="note"><CalendarDays size={16} aria-hidden="true" /><span><strong>Consulta de {formatDate(data.meta.generatedAt)}.</strong> {data.meta.isDemo ? 'Dados fictícios. ' : ''}Alterações e envios são feitos pelo NED.{data.meta.qualityStatus !== 'VALID' && ' Existem resultados a validar.'}</span>{ned && <button type="button" className="text-action" onClick={() => setFilters((current) => ({ ...current, snapshotId: undefined }))}>Abrir dados atuais para editar</button>}</div>}
      {(filters.bimester || filters.deadlineScope === 'closed' || filters.accessScope === 'semester') && <div className="detail-scope-note" role="status">{filters.bimester ? filters.bimester + 'º bimestre · ' : ''}{filters.deadlineScope === 'closed' ? 'Entregas com prazo encerrado · ' : ''}{filters.accessScope === 'semester' ? 'Acessos dos docentes do semestre, incluindo disciplinas encerradas.' : ''}</div>}
      {['access', 'deliveries'].includes(section) && <MonitoringFilters value={filters} options={data.filters} disabled={unsavedChanges || refreshing} onChange={(next) => { setManualOpen(false); setFilters(next); }} />}
      <WorkspaceTabs id="monitoring" label="Áreas do acompanhamento docente" value={section} onChange={changeSection} locked={unsavedChanges} tabs={[{ id: 'access', label: 'Acessos', icon: 'chart' }, { id: 'deliveries', label: 'Entregas', icon: 'table' }, ...(!readOnly ? [{ id: 'deadlines', label: 'Prazos', icon: 'calendar' as const }, { id: 'reports', label: 'Relatório por coordenador', icon: 'people' as const }] : [])]} />
      <section id="monitoring-panel-access" role="tabpanel" aria-labelledby="monitoring-tab-access" hidden={section !== 'access'} aria-busy={loading}>
        <AccessOverview data={data.access} filters={filters} disabled={disabled} onChange={setFilters} onTeacher={chooseTeacher} onDeliveries={seeDeliveries} />
      </section>
      <section id="monitoring-panel-deliveries" role="tabpanel" aria-labelledby="monitoring-tab-deliveries" hidden={section !== 'deliveries'} aria-busy={loading}>
        {manualOpen ? <><button className="text-action back-to-deliveries" type="button" disabled={manualDirty} onClick={() => setManualOpen(false)}><ArrowLeft size={17} />Voltar às entregas</button><ManualDeliveryPanel key={[filters.teacherId, filters.courseId, filters.period, filters.modality].join(':')} initialFilters={{ teacherId: filters.teacherId, courseId: filters.courseId, period: filters.period, modality: filters.modality }} active={section === 'deliveries'} refreshKey={manualRefreshKey} onDirtyChange={setManualDirty} onUpdated={load} /></> : <DeliveryOverview data={data.deliveries} filters={filters} disabled={disabled} onChange={setFilters} onTeacher={chooseTeacher} onOpen={setSelected} onManual={openManual} canManage={!readOnly} />}
      </section>
      {!readOnly && <section id="monitoring-panel-deadlines" role="tabpanel" aria-labelledby="monitoring-tab-deadlines" hidden={section !== 'deadlines'}><DeadlinePanel active={section === 'deadlines'} refreshKey={manualRefreshKey} onDirtyChange={setDeadlineDirty} onUpdated={load} /></section>}
      {!readOnly && <section id="monitoring-panel-reports" role="tabpanel" aria-labelledby="monitoring-tab-reports" hidden={section !== 'reports'}><ReportPreviewDialog key={data.meta.snapshotId + ':' + (data.meta.currentDeadlineVersionId || '')} inline open={section === 'reports'} onClose={() => changeSection('access')} /></section>}
      <details className="criteria-help"><summary>Critérios do acompanhamento</summary><div className="criteria-grid"><div><h3>Acessos ao ambiente</h3><p>0–7 dias em dia · 8–14 atenção · 15+ crítico. Um registro por docente, independentemente do número de disciplinas.</p><p>{filters.accessScope === 'semester' ? 'Inclui docentes de disciplinas encerradas no semestre. ' : 'Considera docentes com disciplinas ativas. '}Sem registro e dados a validar são identificados separadamente. A contagem usa a data desta coleta.</p></div><div><h3>Entregas</h3><p>Pendente vencida acumula atraso até entregar. Entregue com atraso fica no histórico de resolvidas. Pendência dentro do prazo permanece em acompanhamento.</p><p>UA: envio do pacote completo. Vídeo: gravação, uma aula por 10h. Materiais replicados e conferidos contam no prazo. Bimestres separados; substitutiva fora dos critérios.</p></div></div></details>
      {data.meta.qualityIssues.length > 0 && <details className="quality-details"><summary>Conferir dados · {data.meta.qualityIssues.length} ocorrência(s)</summary><ul className="quality-issue-list">{data.meta.qualityIssues.map((issue, index) => <li key={issue.code + index}>{issue.message}</li>)}</ul></details>}
      <DeliveryDetails row={selected} onClose={() => setSelected(null)} />
    </>}
  </AppShell>;
}
