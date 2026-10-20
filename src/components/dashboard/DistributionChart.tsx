import { useId } from 'react';
import { CHART_COLORS, donutSegments, formatPercent, type ChartTone } from '@/lib/monitoringCharts';
import { useChartTooltip } from '@/lib/useChartTooltip';
import { ChartTooltip } from './ChartTooltip';

interface Slice { id: string; label: string; value: number; tone: ChartTone }
interface Props { title: string; unit: string; slices: Slice[]; disabled: boolean; onSelect: (id: string) => void; note?: string }

export function DistributionChart({ title, unit, slices, disabled, onSelect, note }: Props) {
  const titleId = useId();
  const tooltip = useChartTooltip();
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const segments = donutSegments(slices.map((slice) => slice.value));
  const circumference = 2 * Math.PI * 82;
  const content = (slice: Slice) => ({ title: slice.label, lines: [{ label: unit, value: slice.value.toLocaleString('pt-BR') + ' de ' + total.toLocaleString('pt-BR') }, { label: 'Proporção no recorte', value: formatPercent(slice.value / total * 100) }], hint: disabled ? undefined : 'Clique ou pressione Enter para filtrar a lista.' });
  return <section className="ned-panel distribution-panel" aria-labelledby={titleId}>
    <header className="ned-panel-heading"><h2 id={titleId}>{title}</h2></header>
    {total ? <div className="distribution-body">
      <svg className="distribution-ring" viewBox="-8 -8 286 286" role="group" aria-label={title}>
        <circle cx={135} cy={135} r={82} fill="none" stroke="#eef3f8" strokeWidth={35} />
        {segments.map((segment, index) => segment.value > 0 && <g {...tooltip.bind('arc-' + slices[index].id, content(slices[index]))} key={slices[index].id} className="ned-donut-pick" role="button" tabIndex={disabled ? -1 : 0} aria-disabled={disabled} aria-label={slices[index].label + ': ' + segment.value + ' de ' + total + ' ' + unit + '. Filtrar lista.'} onClick={() => { tooltip.hide(); if (!disabled) onSelect(slices[index].id); }} onKeyDown={(event) => { if (!disabled && ['Enter', ' '].includes(event.key)) { event.preventDefault(); tooltip.hide(); onSelect(slices[index].id); } }}>
          <circle cx={135} cy={135} r={82} fill="none" stroke={CHART_COLORS[slices[index].tone]} strokeWidth={35} strokeDasharray={Math.max(0, segment.share * circumference - (segment.share === 1 ? 0 : 1.5)) + ' ' + circumference} strokeDashoffset={-segment.offset * circumference} transform="rotate(-90 135 135)" />
        </g>)}
        {segments.map((segment, index) => {
          if (segment.share < .08) return null;
          const angle = (segment.offset + segment.share / 2) * Math.PI * 2 - Math.PI / 2;
          return <text key={slices[index].id} x={135 + Math.cos(angle) * 116} y={139 + Math.sin(angle) * 116} textAnchor="middle" className="donut-percent" aria-hidden="true">{formatPercent(segment.share * 100)}</text>;
        })}
        <text x={135} y={133} textAnchor="middle" className="donut-total">{total.toLocaleString('pt-BR')}</text>
        <text x={135} y={157} textAnchor="middle" className="donut-unit">{unit}</text>
      </svg>
      <div className="distribution-legend">{slices.map((slice) => <button {...tooltip.bind('legend-' + slice.id, content(slice))} key={slice.id} type="button" disabled={disabled} onClick={() => { tooltip.hide(); onSelect(slice.id); }} aria-label={slice.label + ': ' + slice.value + ' de ' + total + ' ' + unit + '. Filtrar lista.'}>
        <span className="distribution-label"><i style={{ background: CHART_COLORS[slice.tone] }} aria-hidden="true" />{slice.label}</span><strong>{slice.value.toLocaleString('pt-BR')} <span>({formatPercent(slice.value / total * 100)})</span></strong>
      </button>)}</div>
    </div> : <div className="ned-chart-empty"><strong>Nenhum registro neste recorte</strong><span>Confira os filtros acima.</span></div>}
    {note && <p className="ned-panel-note">{note}</p>}
    <ChartTooltip {...tooltip.props} />
  </section>;
}
