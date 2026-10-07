import type { DashboardData } from '@/types/dashboard';
interface Selection { label: string; status: string }
export function SummaryBar({ summary, onSelect }: { summary: DashboardData['summary']; onSelect: (selection: Selection) => void }) {
  const metrics = [
    { label: 'Pendentes em atraso', value: summary.requirements.overdue, detail: 'Prazo encerrado', status: 'OVERDUE', tone: 'danger' },
    { label: 'Acessos críticos', value: summary.access.critical + summary.access.never, detail: '15+ dias ou sem registro', status: 'CRITICAL,NEVER', tone: 'danger' },
    { label: 'Entregues com atraso', value: summary.requirements.deliveredLate, detail: 'Entrega já concluída', status: 'DELIVERED_LATE', tone: 'warning' },
  ];
  return <section className="summary-bar" aria-label="Resumo da seleção">{metrics.map((metric) => <button className={'summary-metric metric-' + (metric.value ? metric.tone : 'neutral')} type="button" key={metric.label} disabled={!metric.value} onClick={() => onSelect({ label: metric.label, status: metric.status })}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.detail}</small></button>)}</section>;
}
