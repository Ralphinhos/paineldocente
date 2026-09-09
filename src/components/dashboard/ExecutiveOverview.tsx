import { lazy, Suspense } from "react";
import { ArrowRight, BarChart3, TrendingDown } from "lucide-react";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import type { AssignmentRow, DashboardData } from "@/types/dashboard";

const TrendChart = lazy(() => import("@/components/dashboard/TrendChart"));
export function ExecutiveOverview({ data, onOpen }: { data: DashboardData; onOpen: (row: AssignmentRow) => void }) {
  const exceptions = data.rows.filter((row) => row.severity !== "OK").slice(0, 5);
  return <div className="executive-grid">
    <section className="insight-section trend-section"><div className="section-heading compact"><div><span className="eyebrow"><TrendingDown size={14} />Tendência semanal</span><h2>Exceções por semana</h2><p>Última fotografia registrada em cada semana.</p></div></div><Suspense fallback={<div className="chart-loading">Carregando evolução…</div>}><TrendChart data={data.trend} /></Suspense></section>
    <section className="insight-section"><div className="section-heading compact"><div><span className="eyebrow"><BarChart3 size={14} />Comparativo</span><h2>Situação por modalidade</h2></div></div><div className="modality-list">{data.modalityBreakdown.map((item) => { const percent = item.total ? Math.round(item.compliant / item.total * 100) : 0; return <div key={item.modality}><div><strong>{item.label}</strong><span>{item.issues} disciplina{item.issues === 1 ? "" : "s"} com exceção atual</span></div><div className="progress-track"><span style={{ width: `${percent}%` }} /></div><b>{percent}% regular</b></div>; })}</div></section>
    <section className="insight-section executive-exceptions"><div className="section-heading compact"><div><span className="eyebrow">Prioridade</span><h2>Pontos para decisão</h2></div></div>{exceptions.length ? <div className="priority-list">{exceptions.map((row) => <button type="button" key={row.id} onClick={() => onOpen(row)}><StatusBadge status={row.severity} /><span><strong>{row.course.shortName}</strong><small>{row.primaryReason}</small></span><ArrowRight size={17} /></button>)}</div> : <div className="empty-inline">Nenhum ponto crítico nesta fotografia.</div>}</section>
  </div>;
}
