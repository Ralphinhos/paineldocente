import { AlertTriangle, ArrowUpRight, CalendarDays, Database, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { apiRequest, toQueryString } from '@/api/client';
import { AppShell } from '@/components/layout/AppShell';
import { SemesterOverview } from '@/components/dashboard/SemesterOverview';
import { SemesterTeacherTable } from '@/components/dashboard/SemesterTeacherTable';
import { SemesterEvolution } from '@/components/dashboard/SemesterEvolution';
import { MonitoringChart } from '@/components/dashboard/MonitoringChart';
import { detailHref, evolutionRangeError, initialEvolutionRange, initialExecutiveFilters } from '@/lib/workspace';
import { formatDate } from '@/lib/presentation';
import type { EvolutionDateRange, ExecutiveData, ExecutiveFilters, ExecutiveHistory } from '@/types/executive';

export function ExecutivePage() {
  const [filters, setFilters] = useState<ExecutiveFilters>(() => initialExecutiveFilters(typeof window === 'undefined' ? '' : window.location.search));
  const [historyRange, setHistoryRange] = useState<EvolutionDateRange>(() => initialEvolutionRange(typeof window === 'undefined' ? '' : window.location.search));
  const [data, setData] = useState<ExecutiveData | null>(null);
  const [history, setHistory] = useState<ExecutiveHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [retry, setRetry] = useState(0);
  const [historyRetry, setHistoryRetry] = useState(0);

  const loadOverview = useCallback(async (signal: AbortSignal) => {
    setLoading(true); setError(null);
    try {
      const result = await apiRequest<ExecutiveData>('/api/executive' + toQueryString({ ...filters }), { signal });
      if (!signal.aborted) setData(result);
    } catch (caught) {
      if (!signal.aborted) setError(caught instanceof Error ? caught.message : 'Não foi possível carregar o resumo.');
    } finally { if (!signal.aborted) setLoading(false); }
  }, [filters]);
  useEffect(() => {
    const controller = new AbortController(); void loadOverview(controller.signal);
    return () => controller.abort();
  }, [loadOverview, retry]);

  useEffect(() => {
    const timer = setTimeout(() => setFilters((current) => current.query === query ? current : { ...current, query, page: 1 }), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const snapshotId = data?.meta.snapshotId;
  const period = data?.meta.period;
  const modality = data?.meta.modality;
  const bimester = data?.meta.bimester;
  const loadHistory = useCallback(async (signal: AbortSignal) => {
    if (!snapshotId || !period) return;
    setHistoryLoading(true); setHistoryError(null); setHistory(null);
    const invalidRange = evolutionRangeError(historyRange);
    if (invalidRange) { setHistoryError(invalidRange); setHistoryLoading(false); return; }
    try {
      const result = await apiRequest<ExecutiveHistory>('/api/executive/history' + toQueryString({ snapshotId, period, modality, bimester, ...historyRange }), { signal });
      if (!signal.aborted) setHistory(result);
    } catch (caught) {
      if (!signal.aborted) setHistoryError(caught instanceof Error ? caught.message : 'Histórico indisponível.');
    } finally { if (!signal.aborted) setHistoryLoading(false); }
  }, [snapshotId, period, modality, bimester, historyRange]);
  useEffect(() => {
    const controller = new AbortController(); void loadHistory(controller.signal);
    return () => controller.abort();
  }, [loadHistory, historyRetry]);

  useEffect(() => {
    if (!data) return;
    const params = new URLSearchParams({ period: data.meta.period });
    if (data.meta.modality) params.set('modality', data.meta.modality);
    if (data.meta.bimester) params.set('bimester', data.meta.bimester);
    if (filters.snapshotId) params.set('snapshotId', filters.snapshotId);
    if (historyRange.dateFrom) params.set('dateFrom', historyRange.dateFrom);
    if (historyRange.dateTo) params.set('dateTo', historyRange.dateTo);
    window.history.replaceState(null, '', '/gestao?' + params.toString());
  }, [data, filters.snapshotId, historyRange]);

  const changeScope = useCallback((change: Partial<ExecutiveFilters>) => {
    setData(null); setHistory(null); setQuery('');
    setFilters((current) => ({ ...current, ...change, query: '', page: 1, snapshotId: undefined }));
  }, []);
  const reload = () => { setFilters((current) => ({ ...current, snapshotId: undefined })); setRetry((current) => current + 1); };
  const header = <><div className="ned-page-heading"><h1>Panorama Docente</h1><p>Alta Gestão · acompanhamento por semestre</p></div><div className="ned-header-actions">
    <span className="ned-collection-date"><CalendarDays size={17} aria-hidden="true" />{data ? 'Referência: ' + formatDate(data.meta.generatedAt) : 'Carregando referência…'}</span>
    <button type="button" className="secondary-button" disabled={loading} onClick={reload}><RefreshCw size={16} className={loading ? 'spin' : ''} aria-hidden="true" />Recarregar</button>
    {data && <a className="primary-button" href={detailHref(data.meta)}>Ver detalhamento<ArrowUpRight size={17} aria-hidden="true" /></a>}
  </div></>;
  return <AppShell workspace="executive" header={header}>
    {error && <div className="page-error" role="alert"><AlertTriangle size={18} aria-hidden="true" /><span>{error}{data && ' A referência anterior permanece visível.'}</span><button type="button" onClick={reload}>Tentar novamente</button>{!data && <button type="button" onClick={() => changeScope({ period: '', modality: '', bimester: '' })}>Limpar recorte</button>}</div>}
    {!data && loading && <div className="dashboard-skeleton" role="status" aria-label="Carregando análise semestral"><div /><div /><div /><span className="sr-only">Carregando resumo…</span></div>}
    {data && <>
      {data.meta.isDemo ? <div className="guard-banner guard-demo" role="note"><Database size={16} aria-hidden="true" /><span><strong>Demonstração com dados fictícios.</strong> Nenhum e-mail é enviado.</span></div>
        : (data.meta.qualityStatus !== 'VALID' || data.meta.rulesStatus === 'PILOT' || data.meta.deadlinesChanged) && <div className="guard-banner guard-warning" role="status"><AlertTriangle size={16} aria-hidden="true" /><span><strong>Resultados em validação pelo NED.</strong> Confira as evidências antes de usar os indicadores em cobranças.</span></div>}
      <section className="executive-scope-bar" aria-label="Recorte da análise semestral"><label><span>Semestre</span><select value={data.meta.period} disabled={loading} onChange={(event) => changeScope({ period: event.target.value })}>{data.filters.periods.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span>Modalidade</span><select value={filters.modality} disabled={loading} onChange={(event) => changeScope({ modality: event.target.value, bimester: '' })}><option value="">Todas as modalidades</option>{data.filters.modalities.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
        <label><span>Entregas</span><select value={filters.bimester} disabled={loading || !['', 'SEMESTRAL'].includes(filters.modality)} onChange={(event) => changeScope({ bimester: event.target.value, ...(event.target.value ? { modality: 'SEMESTRAL' } : {}) })}><option value="">Todas as atividades</option><option value="1">1º bimestre · semestral</option><option value="2">2º bimestre · semestral</option></select></label>
        <p>Referência de <strong>{formatDate(data.meta.generatedAt)}</strong>. Acessos representam essa coleta, não uma média do semestre.{filters.bimester && ' Bimestre filtra somente as entregas.'}{data.meta.stale && ' Há uma referência histórica; consulte a data antes de interpretar.'}</p>
      </section>
      <SemesterOverview data={data} disabled={loading} />
      <div className="executive-section-title"><h2>Histórico e prioridades</h2><span>Do panorama ao problema específico</span></div>
      <div className="monitoring-charts executive-history-grid">
        <SemesterEvolution points={history?.points || []} loading={historyLoading} error={historyError} range={historyRange} onRangeChange={setHistoryRange} onRetry={() => setHistoryRetry((current) => current + 1)} onSelect={(id) => window.location.assign(detailHref({ ...data.meta, snapshotId: id }, { section: 'deliveries', ...historyRange }))} />
        <MonitoringChart title="Onde estão as pendências" description="Top 10 atividades com mais itens vencidos ainda abertos" unit="pendências vencidas" disabled={loading} compact actionLabel="Abrir detalhamento" empty="Nenhuma pendência vencida neste recorte" footnote="Modalidade e atividade identificadas. Entregas já resolvidas com atraso não entram nesta lista."
          bars={data.activities.map((item) => ({ id: item.id, label: `${item.modality} · ${item.label}`, value: item.overdue, detail: `${item.overdue} vencida(s) · maior atraso aberto: ${item.maxDaysLate} dias`, tone: 'rose' as const }))}
          onSelect={(activityKey) => window.location.assign(detailHref(data.meta, { section: 'deliveries', deliveryStatus: 'OVERDUE', activityKey }))} />
      </div>
      <SemesterTeacherTable data={data} query={query} sort={filters.sort} disabled={loading} onQuery={setQuery} onSort={(sort) => setFilters((current) => ({ ...current, sort, page: 1 }))} onPage={(page) => setFilters((current) => ({ ...current, page }))} />
      <details className="criteria-help"><summary>Como interpretar os indicadores</summary><div className="criteria-grid"><div><h3>Entregas e comparações</h3><p>Top 10 usa a proporção sobre prazos encerrados e verificáveis. Antecipadas e replicadas contam no prazo; pendências futuras e dispensas não distorcem a base. Sem prazo encerrado, o percentual fica indisponível.</p><p>Entregue com atraso é histórico resolvido. Pendente vencida ainda exige ação. Acesso e entrega são indicadores distintos.</p></div><div><h3>Referência e detalhes</h3><p>A seleção do semestre recupera sua última coleta disponível. Os acessos usam o último acesso ao ambiente nessa coleta, incluindo docentes de disciplinas já encerradas. A evolução usa referências comparáveis.</p><p>Abra um gráfico ou docente para consultar os mesmos dados detalhados. A Alta Gestão consulta; o NED altera prazos e materiais.</p></div></div></details>
    </>}
  </AppShell>;
}
