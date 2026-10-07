import { lazy, Suspense } from 'react';
import { ExecutiveCharts, type ExecutiveVisualSelection } from './ExecutiveCharts';
import { TeacherRanking } from './TeacherRanking';
import type { DashboardData, RankingEntry } from '@/types/dashboard';
const TrendChart = lazy(() => import('./TrendChart'));
export function ExecutiveOverview({ data, onTeacher, onVisual }: { data: DashboardData; onTeacher: (entry: RankingEntry) => void; onVisual: (selection: ExecutiveVisualSelection) => void }) {
  return <div className="executive-grid">
    <ExecutiveCharts data={data.visuals} onSelect={onVisual} />
    <TeacherRanking data={data.ranking} onSelect={onTeacher} />
    <details className="secondary-analysis"><summary>Histórico e modalidades</summary><div className="secondary-analysis-grid">
      <section className="insight-section"><div className="section-heading"><h2>Acompanhamento por semana</h2></div>{data.trend.length > 1 ? <Suspense fallback={<div className="chart-loading">Carregando histórico…</div>}><TrendChart data={data.trend} /></Suspense> : <p className="empty-inline">O histórico aparece após duas semanas de coletas com as mesmas regras e filtros.</p>}</section>
      <section className="insight-section"><div className="section-heading"><h2>Disciplinas por modalidade</h2></div><div className="modality-list">{data.modalityBreakdown.map((item) => <div key={item.modality}><strong>{item.label}</strong><span>{item.issues} de {item.total} com ocorrência</span><div className="progress-track"><span style={{ width: (item.total ? item.compliant / item.total * 100 : 0) + '%' }} /></div></div>)}</div></section>
    </div></details>
  </div>;
}
