import { useId, type KeyboardEvent } from 'react';
import { CHART_COLORS, chartLabel, integerScale, type ChartTone } from '@/lib/monitoringCharts';
export type { ChartTone } from '@/lib/monitoringCharts';

interface Bar { id: string; label: string; value: number | null; detail: string; tone: ChartTone; unavailableLabel?: string; valueLabel?: string }
interface Props {
  title: string; description: string; unit: string; bars: Bar[]; empty: string;
  onSelect: (id: string) => void; disabled: boolean; footnote: string;
  legend?: Array<{ label: string; tone: ChartTone }>; compact?: boolean;
}

export function MonitoringChart({ title, description, unit, bars, empty, onSelect, disabled, footnote, legend = [], compact = false }: Props) {
  const titleId = useId();
  const helpId = useId();
  const { ceiling, ticks } = integerScale(bars.map((bar) => bar.value));
  const width = compact ? 420 : 640;
  const plot = { left: compact ? 164 : 180, right: width - 66, top: 18 };
  const height = Math.max(compact ? 130 : 284, bars.length * 38 + 68);
  const x = (value: number) => plot.left + value / ceiling * (plot.right - plot.left);
  const selectByKeyboard = (event: KeyboardEvent<SVGGElement>, id: string) => {
    if (!disabled && ['Enter', ' '].includes(event.key)) { event.preventDefault(); onSelect(id); }
  };
  return <section className={'ned-panel monitoring-chart' + (compact ? ' chart-compact' : '')} aria-labelledby={titleId}>
    <header className="ned-panel-heading"><h2 id={titleId}>{title}</h2><p id={helpId}>{description}</p></header>
    {bars.length ? <>
      <div className="ned-plot-scroll" tabIndex={0} role="region" aria-label={title + '; role para ver todas as informações'}>
        <svg className="ned-horizontal-plot" width={width} height={height} viewBox={'0 0 ' + width + ' ' + height} role="group" aria-labelledby={titleId} aria-describedby={helpId}>
          {ticks.map((tick) => <g key={tick} aria-hidden="true"><line x1={x(tick)} x2={x(tick)} y1={plot.top} y2={plot.top + bars.length * 38} className="ned-plot-grid" /><text x={x(tick)} y={plot.top + bars.length * 38 + 20} textAnchor="middle" className="ned-axis-label">{tick.toLocaleString('pt-BR')}</text></g>)}
          {bars.map((bar, index) => {
            const y = plot.top + index * 38;
            const label = chartLabel(bar.label, compact ? 24 : 29);
            const accessible = bar.label + ': ' + (bar.value == null ? bar.unavailableLabel || 'A validar' : bar.value.toLocaleString('pt-BR') + ' ' + unit) + '. ' + bar.detail + '. Clique para filtrar.';
            return <g key={bar.id} className="ned-chart-pick" role="button" tabIndex={disabled ? -1 : 0} aria-disabled={disabled} aria-label={accessible} onClick={() => { if (!disabled) onSelect(bar.id); }} onKeyDown={(event) => selectByKeyboard(event, bar.id)}>
              <title>{accessible}</title><rect x={2} y={y} width={width - 4} height={36} rx={4} className="ned-chart-target" />
              <text x={plot.left - 12} y={y + (label[1] ? 12 : 20)} textAnchor="end" className="ned-bar-label"><tspan x={plot.left - 12}>{label[0]}</tspan>{label[1] && <tspan x={plot.left - 12} dy={14}>{label[1]}</tspan>}</text>
              {bar.value == null ? <text x={plot.left + 8} y={y + 20} className="ned-bar-label">{bar.unavailableLabel || 'A validar'}</text> : <>
                {bar.value === 0 ? <circle cx={plot.left} cy={y + 17} r={3} fill={CHART_COLORS[bar.tone]} /> : <rect x={plot.left} y={y + 7} width={x(bar.value) - plot.left} height={21} rx={4} fill={CHART_COLORS[bar.tone]} />}
                <text x={x(bar.value) + 9} y={y + 22} className="ned-bar-value">{bar.valueLabel || bar.value.toLocaleString('pt-BR')}</text>
              </>}
            </g>;
          })}
          <text x={(plot.left + plot.right) / 2} y={plot.top + bars.length * 38 + 42} textAnchor="middle" className="ned-axis-label">{unit}</text>
        </svg>
      </div>
      {legend.length > 0 && <div className="ned-chart-legend">{legend.map((entry) => <span key={entry.label}><i style={{ background: CHART_COLORS[entry.tone] }} aria-hidden="true" />{entry.label}</span>)}</div>}
    </> : <div className="ned-chart-empty"><strong>{empty}</strong><span>Confira o recorte nos filtros acima.</span></div>}
    <p className="ned-panel-note">{footnote}</p>
  </section>;
}
