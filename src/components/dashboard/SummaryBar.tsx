import { ArrowUpRight } from 'lucide-react';
import type { DashboardData, VisualSelection } from '@/types/dashboard';

export function SummaryBar({ summary, onSelect }: { summary: DashboardData['summary']; onSelect: (selection: VisualSelection) => void }) {
  const req = summary.requirements;
  const percent = (count: number) => req.total ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(count / req.total * 100) + '%' : '—';
  const metrics = [
    { label: 'Entregues no prazo', value: req.deliveredOnTime + req.inheritedReady, detail: 'Inclui antecipadas e replicadas', status: 'DELIVERED_ON_TIME,INHERITED_READY', tone: 'success' },
    { label: 'Entregues com atraso', value: req.deliveredLate, detail: 'Entrega concluída', status: 'DELIVERED_LATE', tone: 'late' },
    { label: 'Pendentes em atraso', value: req.overdue, detail: 'Prazo encerrado', status: 'OVERDUE', tone: 'danger' },
    { label: 'Pendentes no prazo', value: req.pending - req.overdue, detail: 'Prazo ainda aberto', status: 'WITHIN_DEADLINE', tone: 'pending' },
  ];
  return <div className="overview-metrics">
    <section className="summary-bar" aria-label="Situação das atividades">{metrics.map((metric) => <button className={'summary-metric metric-' + metric.tone} type="button" key={metric.label} onClick={() => onSelect({ label: metric.label, status: metric.status })}>
      <span>{metric.label}<ArrowUpRight size={16} aria-hidden="true" /></span><div><strong>{metric.value}</strong><b>{percent(metric.value)}</b></div><small>{metric.detail}</small>
    </button>)}</section>
    <div className="scope-line"><span><b>{summary.monitoredTeachers}</b> docentes · <b>{summary.courses}</b> disciplinas · <b>{req.total}</b> atividades aplicáveis</span><span>{req.notVerifiable > 0 && <button type="button" className="text-action" onClick={() => onSelect({ label: 'Atividades a validar', status: 'NOT_VERIFIABLE' })}>{req.notVerifiable} a validar</button>}{req.notApplicable > 0 && <span>{req.notApplicable} não aplicáveis</span>}<span>% sobre as atividades aplicáveis</span></span></div>
  </div>;
}
