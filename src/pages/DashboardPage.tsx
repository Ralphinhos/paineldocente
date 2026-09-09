import { CalendarDays, Check, FileText, RefreshCw, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiRequest, toQueryString } from "@/api/client";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardFilters } from "@/components/dashboard/DashboardFilters";
import { DataGuardBanner } from "@/components/dashboard/DataGuardBanner";
import { EvidenceDrawer } from "@/components/dashboard/EvidenceDrawer";
import { ExceptionTable } from "@/components/dashboard/ExceptionTable";
import { ExecutiveOverview } from "@/components/dashboard/ExecutiveOverview";
import { ManualDeliveryPanel } from "@/components/dashboard/ManualDeliveryPanel";
import { ReportPreviewDialog } from "@/components/dashboard/ReportPreviewDialog";
import { SummaryBar } from "@/components/dashboard/SummaryBar";
import { useAuth } from "@/contexts/auth";
import type { AssignmentRow, DashboardData, DashboardFilters as FilterState } from "@/types/dashboard";

const EMPTY_FILTERS: FilterState = { period: "", modality: "", courseId: "", status: "", query: "", page: 1 };
function formatGeneratedAt(value: string) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short" }).format(new Date(value)); }
export function DashboardPage() {
  const { user, csrfToken } = useAuth();
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [data, setData] = useState<DashboardData | null>(null);
  const [selected, setSelected] = useState<AssignmentRow | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError(null);
    try { setData(await apiRequest<DashboardData>(`/api/dashboard${toQueryString({ ...filters, pageSize: user?.role === "executive" ? 50 : 20 })}`, { signal })); }
    catch (caught) { if ((caught as Error).name !== "AbortError") setError(caught instanceof Error ? caught.message : "Não foi possível carregar o painel."); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [filters, user?.role]);
  useEffect(() => { const controller = new AbortController(); const timeout = window.setTimeout(() => void load(controller.signal), filters.query ? 250 : 0); return () => { window.clearTimeout(timeout); controller.abort(); }; }, [load, filters.query]);
  const refresh = async () => { setRefreshing(true); setError(null); try { await apiRequest("/api/operations/snapshots", { method: "POST", csrfToken }); await load(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Falha ao atualizar os dados."); } finally { setRefreshing(false); } };
  const executive = user?.role === "executive";
  return <AppShell>
    <div className="page-header"><div><span className="eyebrow"><CalendarDays size={14} />Ciclo de acompanhamento</span><h1>{executive ? "Visão executiva" : user?.role === "coordinator" ? "Minhas disciplinas" : "Acompanhamento docente"}</h1><p>{executive ? "Situação consolidada para decisão." : "Entregas, acessos e evidências em uma única fotografia."}</p></div><div className="header-actions">{user?.role === "ned_admin" && <button className="secondary-button" type="button" disabled={refreshing} onClick={() => void refresh()}><RefreshCw size={17} className={refreshing ? "spin" : ""} />{refreshing ? "Atualizando…" : "Atualizar dados agora"}</button>}<button className="primary-button" type="button" disabled={!data} onClick={() => setReportOpen(true)}><FileText size={17} />Ver relatório semanal</button></div></div>
    {error && <div className="page-error" role="alert"><ShieldAlert size={19} /><span>{error}</span><button type="button" onClick={() => void load()}>Tentar novamente</button></div>}
    {loading && !data ? <div className="dashboard-loading"><span className="spinner" /><strong>Organizando os dados…</strong></div> : data && <>
      <DataGuardBanner meta={data.meta} />
      <div className="snapshot-line"><span><Check size={14} />Fotografia {data.meta.snapshotId.slice(0, 8)}</span><span>Gerada em {formatGeneratedAt(data.meta.generatedAt)}</span><span>Regra {data.meta.rulesVersion}</span></div>
      <SummaryBar summary={data.summary} />
      {user?.role === "ned_admin" && <ManualDeliveryPanel onUpdated={async () => { await load(); }} />}
      {executive ? <ExecutiveOverview data={data} onOpen={setSelected} /> : <><DashboardFilters value={filters} options={data.filters} onChange={setFilters} /><ExceptionTable data={data} filters={filters} onFilters={setFilters} onOpen={setSelected} /></>}
      {user?.role === "ned_admin" && data.meta.qualityIssues.length > 0 && <section className="quality-section"><div className="section-heading compact"><div><span className="eyebrow">Controle de qualidade</span><h2>Bloqueios antes da publicação</h2></div><strong>{data.meta.qualityIssues.length} ocorrência{data.meta.qualityIssues.length === 1 ? "" : "s"}</strong></div><ul>{data.meta.qualityIssues.map((issue, index) => <li key={`${issue.code}-${issue.courseId || index}`}><span className={`quality-dot dot-${issue.severity.toLowerCase()}`} /><div><strong>{issue.message}</strong><small>{issue.code}{issue.courseId ? ` · disciplina ${issue.courseId}` : ""}</small></div></li>)}</ul></section>}
      <EvidenceDrawer row={selected} onClose={() => setSelected(null)} />
      <ReportPreviewDialog open={reportOpen} meta={data.meta} onClose={() => setReportOpen(false)} />
    </>}
  </AppShell>;
}
