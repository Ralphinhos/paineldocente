import { useId } from 'react';
import { useChartTooltip } from '@/lib/useChartTooltip';
import { CHART_COLORS, integerScale } from '@/lib/monitoringCharts';
import { formatDate } from '@/lib/presentation';
import { ChartTooltip } from './ChartTooltip';
import type { SemesterPoint } from '@/types/executive';

const series = [
  { key: 'onTime', label: 'No prazo', tone: 'green' }, { key: 'overdue', label: 'Pendente vencida', tone: 'rose' },
  { key: 'deliveredLate', label: 'Entregue com atraso', tone: 'amber' }, { key: 'pending', label: 'Pendente no prazo', tone: 'blue' },
  { key: 'validation', label: 'A validar', tone: 'slate' },
] as const;

export function SemesterEvolution({ points, loading, error, onRetry, onSelect }: {
  points: SemesterPoint[]; loading: boolean; error: string | null; onRetry: () => void; onSelect: (id: string) => void;
}) {
  const id = useId(); const tooltip = useChartTooltip();
  const width = Math.max(620, points.length * 44 + 90); const left = 45; const bottom = 218; const plotHeight = 170;
  const { ceiling, ticks } = integerScale(points.map((point) => point.total));
  return <section className="ned-panel executive-evolution" aria-labelledby={id} aria-busy={loading}>
    <header className="ned-panel-heading"><h2 id={id}>Evolução das entregas</h2><p>Uma referência por semana · estados que não se sobrepõem</p></header>
    {error ? <div className="executive-chart-message" role="status"><p>{error}</p><button type="button" className="secondary-button" onClick={onRetry}>Recarregar evolução</button></div>
      : loading ? <div className="executive-chart-message" role="status">Carregando histórico do semestre…</div>
      : points.length < 2 ? <div className="executive-chart-message"><strong>Aguardando outra coleta comparável</strong><p>O histórico aparece conforme o NED atualiza os dados. Nenhuma evolução é estimada.</p></div>
      : <><div className="ned-plot-scroll" role="region" aria-label="Evolução semanal das entregas; role horizontalmente" tabIndex={0}><svg width={width} height={274} viewBox={`0 0 ${width} 274`} role="group" aria-labelledby={id}>
        {ticks.map((tick) => <g key={tick} aria-hidden="true"><line x1={left} x2={width - 20} y1={bottom - tick / ceiling * plotHeight} y2={bottom - tick / ceiling * plotHeight} className="ned-plot-grid" /><text x={left - 8} y={bottom - tick / ceiling * plotHeight + 4} textAnchor="end" className="ned-axis-label">{tick}</text></g>)}
        {points.map((point, index) => {
          const step = (width - left - 25) / points.length; const x = left + index * step + step / 2; let offset = 0;
          const content = { title: 'Coleta de ' + formatDate(point.generatedAt), lines: series.map((item) => ({ label: item.label, value: String(point[item.key]) })), hint: 'Clique ou pressione Enter para abrir esta referência.' };
          return <g {...tooltip.bind(point.snapshotId, content)} key={point.snapshotId} role="button" tabIndex={0} className="ned-chart-pick" aria-label={content.title + '. ' + content.lines.map((line) => line.label + ': ' + line.value).join('; ') + '. Abrir referência.'} onClick={() => onSelect(point.snapshotId)} onKeyDown={(event) => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); onSelect(point.snapshotId); } }}>
            <rect x={x - step / 2 + 2} y={24} width={step - 4} height={214} className="ned-chart-target" />
            {series.map((item) => { const h = point[item.key] / ceiling * plotHeight; const y = bottom - offset - h; offset += h; return <rect key={item.key} x={x - Math.min(step * .3, 16)} y={y} width={Math.min(step * .6, 32)} height={h} fill={CHART_COLORS[item.tone]} />; })}
            <text x={x} y={bottom - point.total / ceiling * plotHeight - 8} textAnchor="middle" className="ned-bar-value">{point.total}</text>
            <text x={x} y={bottom + 22} textAnchor="middle" className="ned-axis-label">{formatDate(point.generatedAt).slice(0, 5)}</text>
          </g>;
        })}
      </svg></div><div className="ned-chart-legend">{series.map((item) => <span key={item.key}><i style={{ background: CHART_COLORS[item.tone] }} aria-hidden="true" />{item.label}</span>)}</div></>}
    <p className="ned-panel-note">Até 26 referências semanais disponíveis, com os mesmos critérios e prazos. A quantidade de itens pode mudar entre coletas. Datas completas e valores no tooltip.</p>
    <ChartTooltip {...tooltip.props} />
  </section>;
}
