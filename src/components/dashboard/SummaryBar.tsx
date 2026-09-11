import type { DashboardData } from '@/types/dashboard';
export function SummaryBar({ summary }: { summary: DashboardData['summary'] }) {
  const metrics = [
    { label: 'Docentes monitorados', value: summary.monitoredTeachers, detail: `${summary.courses} disciplinas`, tone: 'neutral' },
    { label: 'Entregas vencidas', value: summary.requirements.overdue, detail: 'Ainda não concluídas', tone: 'danger' },
    { label: 'Acessos críticos', value: summary.access.critical + summary.access.never, detail: '15+ dias ou sem registro', tone: 'danger' },
    { label: 'Atraso médio', value: summary.averageDaysLate == null ? '—' : `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(summary.averageDaysLate)} dias`, detail: `${summary.measuredLateItems} entregas concluídas${summary.unmeasuredLateItems ? ` · ${summary.unmeasuredLateItems} a validar` : ''}`, tone: 'neutral' },
  ];
  return <section className="summary-bar" aria-label="Resumo do acompanhamento">{metrics.map((metric) => <div className={`summary-metric metric-${metric.tone}`} key={metric.label}><span><small>{metric.label}</small><strong>{metric.value}</strong><small>{metric.detail}</small></span></div>)}</section>;
}
