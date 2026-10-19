import type { LucideIcon } from 'lucide-react';

interface Metric {
  label: string;
  value: number;
  total?: number;
  detail: string;
  tone: 'blue' | 'green' | 'rose' | 'amber';
  icon: LucideIcon;
  selected: boolean;
  onClick: () => void;
}

export function MonitoringMetrics({ label, metrics, disabled }: { label: string; metrics: Metric[]; disabled: boolean }) {
  return <section className="monitoring-metrics" aria-label={label}>
    {metrics.map(({ icon: Icon, ...metric }) => <button key={metric.label} type="button" className={'monitoring-metric metric-card-' + metric.tone} disabled={disabled} aria-pressed={metric.selected} onClick={metric.onClick}>
      <span className="metric-card-content">
        <span className="metric-card-label">{metric.label}</span>
        <span className="metric-card-number"><strong>{metric.value.toLocaleString('pt-BR')}</strong>{metric.total != null && <span> / {metric.total.toLocaleString('pt-BR')}</span>}</span>
        <span className="metric-card-detail">{metric.detail}</span>
      </span>
      <span className="metric-card-icon" aria-hidden="true"><Icon size={30} strokeWidth={1.8} /></span>
    </button>)}
  </section>;
}
