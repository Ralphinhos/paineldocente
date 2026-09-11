import { FileText, RefreshCw, ShieldAlert, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { apiRequest, toQueryString } from '@/api/client';
import { AppShell } from '@/components/layout/AppShell';
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { DataGuardBanner } from '@/components/dashboard/DataGuardBanner';
import { EvidenceDrawer } from '@/components/dashboard/EvidenceDrawer';
import { ExceptionTable } from '@/components/dashboard/ExceptionTable';
import { ExecutiveOverview } from '@/components/dashboard/ExecutiveOverview';
import { TeacherRanking } from '@/components/dashboard/TeacherRanking';
import { ManualDeliveryPanel } from '@/components/dashboard/ManualDeliveryPanel';
import { ReportPreviewDialog } from '@/components/dashboard/ReportPreviewDialog';
import { SummaryBar } from '@/components/dashboard/SummaryBar';
import { useAuth } from '@/contexts/auth';
import type { AssignmentRow, DashboardData, DashboardFilters as FilterState, RankingEntry } from '@/types/dashboard';
const EMPTY_FILTERS: FilterState = { period: '', modality: '', courseId: '', status: '', query: '', page: 1 };
function formatGeneratedAt(value: string) { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(value)); }
export function DashboardPage() {
  const { user, csrfToken } = useAuth();
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [data, setData] = useState<DashboardData | null>(null);
  const [selected, setSelected] = useState<AssignmentRow | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<string | null>(null);
  const [section, setSection] = useState('tracking');
  const [manualDirty, setManualDirty] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError(null);
    try { setData(await apiRequest<DashboardData>(`/api/dashboard${toQueryString({ ...filters, pageSize: user?.role === 'executive' ? 50 : 20 })}`, { signal })); }
    catch (caught) { if ((caught as Error).name !== 'AbortError') setError(caught instanceof Error ? caught.message : 'Não foi possível carregar o painel.'); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [filters, user?.role]);
  useEffect(() => { const controller = new AbortController(); const timeout = window.setTimeout(() => void load(controller.signal), filters.query ? 250 : 0); return () => { window.clearTimeout(timeout); controller.abort(); }; }, [load, filters.query]);
  const refresh = async () => { setRefreshing(true); setError(null); try { await apiRequest('/api/operations/snapshots', { method: 'POST', csrfToken }); await load(); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Falha ao atualizar os dados.'); } finally { setRefreshing(false); } };
  const executive = user?.role === 'executive';
  const ned = user?.role === 'ned_admin';
  const chooseTeacher = (entry: RankingEntry) => { setSelectedTeacher(entry.teacher.name); setFilters((current) => ({ ...current, teacherId: entry.teacher.id, status: '', page: 1 })); };
  const patchFilters = (next: FilterState) => { if (!next.teacherId) setSelectedTeacher(null); setFilters(next); };
  return <AppShell>
    <div className="page-header"><div><h1>{executive ? 'Acompanhamento executivo' : user?.role === 'coordinator' ? 'Minhas disciplinas' : 'Acompanhamento docente'}</h1>{data && <p>Atualizado em {formatGeneratedAt(data.meta.generatedAt)}{loading ? ' · Atualizando…' : ''}</p>}</div><div className="header-actions">{ned && <button className="secondary-button" type="button" disabled={refreshing || manualDirty} onClick={() => void refresh()}><RefreshCw size={17} className={refreshing ? 'spin' : ''} />{refreshing ? 'Atualizando…' : 'Atualizar dados'}</button>}<button className="primary-button" type="button" disabled={!data || manualDirty} onClick={() => setReportOpen(true)}><FileText size={17} />Relatório semanal</button></div></div>
    {error && <div className="page-error" role="alert"><ShieldAlert size={19} /><span>{error}</span><button type="button" onClick={() => void load()}>Tentar novamente</button></div>}
    {loading && !data ? <div className="dashboard-skeleton" aria-label="Carregando acompanhamento"><div /><div /><div /></div> : data && <>
      <DataGuardBanner meta={data.meta} />
      {ned && <nav className="workspace-nav" aria-label="Áreas do NED">{[['tracking', 'Acompanhamento'], ['manual', 'UA e videoaulas'], ['quality', `Qualidade e envios${data.meta.qualityIssues.length ? ` (${data.meta.qualityIssues.length})` : ''}`]].map(([key, label]) => <button type="button" key={key} aria-pressed={section === key} disabled={manualDirty && section !== key} onClick={() => setSection(key)}>{label}</button>)}</nav>}
      <div hidden={ned && section !== 'tracking'} aria-busy={loading}>
        <DashboardFilters value={filters} options={data.filters} onChange={patchFilters} />
        {selectedTeacher && <div className="selected-teacher"><span>Docente: <strong>{selectedTeacher}</strong></span><button className="link-button" type="button" onClick={() => { setSelectedTeacher(null); setFilters((current) => ({ ...current, teacherId: '', page: 1 })); }}><X size={16} />Voltar a todos</button></div>}
        <SummaryBar summary={data.summary} />
        {executive && !selectedTeacher ? <ExecutiveOverview data={data} onOpen={setSelected} onTeacher={chooseTeacher} /> : <>
          {!selectedTeacher && <details className="coordinator-ranking"><summary>Ranking docente · 50 / 20 / 30</summary><TeacherRanking data={data.ranking} onSelect={chooseTeacher} /></details>}
          <ExceptionTable data={data} filters={filters} onFilters={patchFilters} onOpen={setSelected} />
        </>}
      </div>
      {ned && <div hidden={section !== 'manual'}><ManualDeliveryPanel active={section === 'manual'} onDirtyChange={setManualDirty} onUpdated={load} /></div>}
      {ned && section === 'quality' && <section className="quality-section"><div className="section-heading compact"><div><h2>Validação e publicação</h2><p>{data.meta.publishAllowed ? 'Dados liberados para envio.' : 'Confira as ocorrências antes de publicar.'}</p></div><button className="secondary-button" type="button" onClick={() => setReportOpen(true)}>Conferir relatório</button></div><details className="source-details"><summary>Origem e regras desta coleta</summary><p>Coleta {data.meta.snapshotId} · Regra {data.meta.rulesVersion} · {data.meta.source === 'demo' ? 'Demonstração' : 'Moodle'}</p></details>{data.meta.qualityIssues.length ? <ul>{data.meta.qualityIssues.map((issue, index) => <li key={`${issue.code}-${index}`}><span className={`quality-dot dot-${issue.severity.toLowerCase()}`} /><div><strong>{issue.message}</strong></div></li>)}</ul> : <p className="empty-inline">Nenhum bloqueio localizado.</p>}</section>}
      <EvidenceDrawer row={selected} onClose={() => setSelected(null)} />
      <ReportPreviewDialog open={reportOpen} onClose={() => setReportOpen(false)} />
    </>}
  </AppShell>;
}
