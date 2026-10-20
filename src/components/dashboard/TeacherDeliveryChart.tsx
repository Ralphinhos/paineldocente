import { useId, type KeyboardEvent } from 'react';
import { CHART_COLORS, chartLabel, formatPercent, integerScale, type ChartTone } from '@/lib/monitoringCharts';
import type { TeacherDeliveryOverview } from '@/types/monitoring';
import { useChartTooltip } from '@/lib/useChartTooltip';
import { ChartTooltip } from './ChartTooltip';

const series: Array<{ key: keyof TeacherDeliveryOverview['counts']; label: string; tone: ChartTone }> = [
  { key: 'early', label: 'Antecipadas', tone: 'blue' }, { key: 'onTime', label: 'No prazo / replicadas', tone: 'green' },
  { key: 'deliveredLate', label: 'Entregues com atraso', tone: 'orange' }, { key: 'pendingInTime', label: 'Pendentes no prazo', tone: 'yellow' },
  { key: 'overdue', label: 'Pendências vencidas', tone: 'rose' }, { key: 'validation', label: 'A validar', tone: 'slate' },
];

export function TeacherDeliveryChart({ rows, disabled, onTeacher }: { rows: TeacherDeliveryOverview[]; disabled: boolean; onTeacher: (id: string) => void }) {
  const titleId = useId();
  const tooltip = useChartTooltip();
  const visible = rows.slice(0, 10);
  const { ceiling, ticks } = integerScale(visible.map((row) => row.total));
  const plot = { left: 180, width: 390, top: 18 };
  const height = Math.max(112, visible.length * 40 + 64);
  const scale = (value: number) => value / ceiling * plot.width;
  const keyboard = (event: KeyboardEvent<SVGGElement>, id: string) => { if (!disabled && ['Enter', ' '].includes(event.key)) { event.preventDefault(); tooltip.hide(); onTeacher(id); } };
  return <section className="ned-panel teacher-delivery-chart" aria-labelledby={titleId}>
    <header className="ned-panel-heading"><h2 id={titleId}>Situação das entregas por docente</h2><span>Top 10 · pendências primeiro</span></header>
    <div className="ned-chart-legend">{series.map((item) => <span key={item.key}><i style={{ background: CHART_COLORS[item.tone] }} aria-hidden="true" />{item.label}</span>)}</div>
    {visible.length ? <div className="ned-plot-scroll" role="region" tabIndex={0} aria-label="Entregas por docente; role para ver todas as informações">
      <svg className="ned-horizontal-plot" style={{ maxWidth: 680 }} width={680} height={height} viewBox={'0 0 680 ' + height} role="group" aria-labelledby={titleId}>
        {ticks.map((tick) => <g key={tick} aria-hidden="true"><line x1={plot.left + scale(tick)} x2={plot.left + scale(tick)} y1={plot.top} y2={plot.top + visible.length * 40} className="ned-plot-grid" /><text x={plot.left + scale(tick)} y={plot.top + visible.length * 40 + 20} textAnchor="middle" className="ned-axis-label">{tick}</text></g>)}
        {visible.map((row, index) => {
          let offset = 0;
          const y = plot.top + index * 40;
          const label = chartLabel(row.teacher.name, 29);
          const detail = row.counts.overdue + ' pendências em ' + row.due + ' itens já exigíveis (' + formatPercent(row.overduePercent) + '). Maior atraso: ' + row.maxDaysLate + ' dias. ' + row.counts.validation + ' a validar.';
          return <g {...tooltip.bind(row.teacher.id, { title: row.teacher.name, lines: [...series.map((item) => ({ label: item.label, value: (row.counts[item.key] + (item.key === 'onTime' ? row.counts.inherited : 0)).toLocaleString('pt-BR') })), { label: 'Maior atraso em aberto', value: row.maxDaysLate + ' dias' }, { label: 'Pendências / exigíveis', value: row.counts.overdue + ' / ' + row.due + ' · ' + formatPercent(row.overduePercent) }], hint: disabled ? undefined : 'Clique ou pressione Enter para filtrar o docente.' })} className="ned-chart-pick" role="button" tabIndex={disabled ? -1 : 0} aria-disabled={disabled} key={row.teacher.id} aria-label={row.teacher.name + ': ' + detail + ' Filtrar docente.'} onClick={() => { tooltip.hide(); if (!disabled) onTeacher(row.teacher.id); }} onKeyDown={(event) => keyboard(event, row.teacher.id)}>
            <rect x={2} y={y} width={672} height={38} rx={4} className="ned-chart-target" />
            <text x={plot.left - 12} y={y + (label[1] ? 13 : 22)} textAnchor="end" className="ned-bar-label"><tspan x={plot.left - 12}>{label[0]}</tspan>{label[1] && <tspan x={plot.left - 12} dy={14}>{label[1]}</tspan>}</text>
            {series.map((item) => {
              const value = row.counts[item.key] + (item.key === 'onTime' ? row.counts.inherited : 0);
              const x = plot.left + scale(offset); offset += value;
              return value > 0 && <g key={item.key}><rect x={x} y={y + 7} width={scale(value)} height={24} fill={CHART_COLORS[item.tone]} stroke="white" strokeWidth={1} />{scale(value) > 22 && <text x={x + scale(value) / 2} y={y + 24} textAnchor="middle" className={'ned-stack-value ' + (['yellow', 'orange'].includes(item.tone) ? 'stack-value-dark' : '')}>{value}</text>}</g>;
            })}
            <text x={plot.left + plot.width + 10} y={y + 17} className="ned-overdue-number">{row.counts.overdue > 0 ? row.maxDaysLate + ' dias' : row.counts.validation ? 'A validar' : 'Sem vencidas'}</text>
            <text x={plot.left + plot.width + 10} y={y + 31} className="ned-bar-detail">{row.counts.overdue > 0 ? row.counts.overdue + '/' + row.due + ' · ' + formatPercent(row.overduePercent) : ''}</text>
          </g>;
        })}
        <text x={plot.left + plot.width / 2} y={plot.top + visible.length * 40 + 42} textAnchor="middle" className="ned-axis-label">Número de atividades</text>
      </svg>
    </div> : <div className="ned-chart-empty"><strong>Nenhuma entrega com responsável confirmado</strong><span>Confira o recorte e os itens a validar.</span></div>}
    <p className="ned-panel-note">Responsáveis confirmados. Ao lado: maior atraso e pendências / itens já exigíveis. Dados a validar ficam fora desse percentual.</p>
    <ChartTooltip {...tooltip.props} />
  </section>;
}
