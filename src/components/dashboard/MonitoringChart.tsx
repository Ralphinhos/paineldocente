import { BarChart3 } from 'lucide-react';
import { useId, type KeyboardEvent } from 'react';
import { chartLabel, integerScale } from '@/lib/monitoringCharts';

export type ChartTone = 'blue' | 'green' | 'rose' | 'amber' | 'purple' | 'slate';
const colors: Record<ChartTone, string> = { blue: '#3b82f6', green: '#059669', rose: '#f43f5e', amber: '#d97706', purple: '#8b5cf6', slate: '#64748b' };
interface Bar { id: string; label: string; value: number | null; detail: string; tone: ChartTone; unavailableLabel?: string }
interface Props {
  title: string; description: string; unit: string; bars: Bar[]; empty: string;
  onSelect: (id: string) => void; disabled: boolean; footnote: string;
  legend?: Array<{ label: string; tone: ChartTone }>;
}

export function MonitoringChart({ title, description, unit, bars, empty, onSelect, disabled, footnote, legend = [] }: Props) {
  const titleId = useId();
  const helpId = useId();
  const { ceiling, ticks } = integerScale(bars.map((bar) => bar.value));
  const width = Math.max(560, 74 + bars.length * 84);
  const plot = { left: 48, right: width - 18, top: 34, bottom: 254 };
  const slot = (plot.right - plot.left) / Math.max(1, bars.length);
  const y = (value: number) => plot.bottom - value / ceiling * (plot.bottom - plot.top);
  const selectByKeyboard = (event: KeyboardEvent<SVGGElement>, id: string) => {
    if (!disabled && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onSelect(id); }
  };
  return <section className="monitoring-chart" aria-labelledby={titleId}>
    <header className="monitoring-chart-heading"><h2 id={titleId}><BarChart3 size={20} aria-hidden="true" />{title}</h2><p id={helpId}>{description}</p></header>
    {bars.length ? <>
      <div className="monitoring-plot-scroll" tabIndex={0} role="region" aria-label={title + '; role para ver todas as barras'}>
        <svg className="monitoring-plot" width={width} height={358} viewBox={`0 0 ${width} 358`} role="group" aria-labelledby={titleId} aria-describedby={helpId}>
          <text x={plot.left} y={14} className="monitoring-axis-unit">{unit}</text>
          {ticks.map((tick) => <g key={tick} aria-hidden="true"><line x1={plot.left} x2={plot.right} y1={y(tick)} y2={y(tick)} className="monitoring-grid-line" /><text x={plot.left - 10} y={y(tick) + 4} textAnchor="end" className="monitoring-axis-tick">{tick.toLocaleString('pt-BR')}</text></g>)}
          {bars.map((bar, index) => {
            const x = plot.left + slot * (index + .5);
            const barWidth = Math.min(44, slot * .58);
            const label = chartLabel(bar.label, Math.min(18, Math.floor((slot - 10) / 6)));
            const valueY = bar.value == null ? plot.bottom : y(bar.value);
            const accessible = `${bar.label}: ${bar.value == null ? bar.unavailableLabel || 'A validar' : bar.value.toLocaleString('pt-BR') + ' ' + unit}. ${bar.detail}. Clique para filtrar.`;
            return <g key={bar.id} className="monitoring-chart-pick" role="button" tabIndex={disabled ? -1 : 0} aria-disabled={disabled} aria-label={accessible} onClick={() => { if (!disabled) onSelect(bar.id); }} onKeyDown={(event) => selectByKeyboard(event, bar.id)}>
              <title>{accessible}</title>
              <rect x={x - slot / 2 + 2} y={plot.top - 16} width={slot - 4} height={320} rx={6} className="monitoring-chart-target" />
              {bar.value == null ? <text x={x} y={plot.bottom - 12} textAnchor="middle" className="monitoring-unavailable-value">{bar.unavailableLabel || 'A validar'}</text> : <>
                {bar.value === 0 ? <circle cx={x} cy={plot.bottom} r={4} fill={colors[bar.tone]} /> : <rect x={x - barWidth / 2} y={valueY} width={barWidth} height={plot.bottom - valueY} rx={4} fill={colors[bar.tone]} />}
                <text x={x} y={valueY - 9} textAnchor="middle" className="monitoring-bar-value">{bar.value.toLocaleString('pt-BR')}</text>
              </>}
              <text x={x} y={plot.bottom + 23} textAnchor="middle" className="monitoring-bar-name"><tspan x={x}>{label[0]}</tspan><tspan x={x} dy={16}>{label[1]}</tspan></text>
              <text x={x} y={plot.bottom + 66} textAnchor="middle" className="monitoring-bar-detail">{chartLabel(bar.detail, Math.min(22, Math.floor((slot - 10) / 5.5))).map((line, lineIndex) => <tspan key={lineIndex} x={x} dy={lineIndex ? 14 : 0}>{line}</tspan>)}</text>
            </g>;
          })}
        </svg>
      </div>
      {legend.length > 0 && <div className="monitoring-chart-legend">{legend.map((entry) => <span key={entry.label}><i style={{ background: colors[entry.tone] }} aria-hidden="true" />{entry.label}</span>)}</div>}
    </> : <div className="chart-empty monitoring-chart-empty"><strong>{empty}</strong><span>Confira o recorte nos filtros acima.</span></div>}
    <p className="monitoring-chart-note">{footnote}</p>
  </section>;
}
