import type { LucideIcon } from 'lucide-react';
import { formatPercent } from '@/lib/monitoringCharts';

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

export function MonitoringMetrics({ label, metrics, disabled, showDetail = false }: { label: string; metrics: Metric[]; disabled: boolean; showDetail?: boolean }) {
  return <section className="monitoring-metrics" aria-label={label}>
    {metrics.map(({ icon: Icon, ...metric }) => <button key={metric.label} type="button" className={'monitoring-metric metric-card-' + metric.tone} disabled={disabled} aria-pressed={metric.selected} onClick={metric.onClick}>
      <span className="metric-card-icon" aria-hidden="true"><Icon size={32} strokeWidth={2} /></span>
      <span className="metric-card-content">
        <span className="metric-card-label">{metric.label}</span>
        <span className="metric-card-number"><strong>{metric.value.toLocaleString('pt-BR')}</strong></span>
        <span className={showDetail ? 'metric-card-detail' : 'sr-only'}>{metric.detail}</span>
      </span>
      {metric.total != null && <span className="metric-card-percent" title={metric.value + ' de ' + metric.total + ' registros no recorte'}>{formatPercent(metric.total ? metric.value / metric.total * 100 : null)}</span>}
    </button>)}
  </section>;
}
