import { lazy, Suspense } from 'react';
import { ArrowRight } from 'lucide-react';
import { TeacherRanking } from './TeacherRanking';
import type { AssignmentRow, DashboardData, RankingEntry } from '@/types/dashboard';
const TrendChart = lazy(() => import('./TrendChart'));
export function ExecutiveOverview({ data, onOpen, onTeacher }: { data: DashboardData; onOpen: (row: AssignmentRow) => void; onTeacher: (entry: RankingEntry) => void }) {
  const exceptions = data.rows.filter((row) => row.severity !== 'OK').slice(0, 5);
  return <div className="executive-grid">
    <TeacherRanking data={data.ranking} onSelect={onTeacher} />
    <section className="insight-section executive-exceptions"><div className="section-heading compact"><div><h2>Ocorrências atuais</h2><p>Continuam visíveis mesmo com nota média alta.</p></div></div>{exceptions.length ? <div className="priority-list">{exceptions.map((row) => <button type="button" key={row.id} onClick={() => onOpen(row)}><span><strong>{row.teacher.name}</strong><small>{row.course.shortName}</small><span>{row.primaryReason}</span></span><ArrowRight size={17} /></button>)}</div> : <div className="empty-inline">Nenhuma ocorrência atual.</div>}</section>
    <section className="insight-section trend-section"><div className="section-heading compact"><div><h2>Pendências e acessos por semana</h2><p>Docente × disciplina · mesma versão de regras e filtros.</p></div></div>{data.trend.length > 1 ? <Suspense fallback={<div className="chart-loading">Carregando evolução…</div>}><TrendChart data={data.trend} /></Suspense> : <div className="empty-inline">A comparação aparecerá após duas semanas de coletas com estas regras.</div>}</section>
    <section className="insight-section modality-section"><div className="section-heading compact"><h2>Disciplinas por modalidade</h2></div><div className="modality-list">{data.modalityBreakdown.map((item) => <div key={item.modality}><div><strong>{item.label}</strong><span>{item.issues} de {item.total} com ocorrência</span></div><div className="progress-track"><span style={{ width: `${item.total ? item.compliant / item.total * 100 : 0}%` }} /></div><b>{item.compliant} regulares</b></div>)}</div></section>
  </div>;
}
