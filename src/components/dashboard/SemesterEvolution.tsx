import { useId, useState } from 'react';
import { useChartTooltip } from '@/lib/useChartTooltip';
import { CHART_COLORS, integerScale } from '@/lib/monitoringCharts';
import { formatDate } from '@/lib/presentation';
import { evolutionRangeError } from '@/lib/workspace';
import { ChartTooltip } from './ChartTooltip';
import type { EvolutionDateRange, SemesterPoint } from '@/types/executive';

const series = [
  { key: 'onTime', label: 'No prazo', tone: 'green' },
  { key: 'overdue', label: 'Pendente vencida', tone: 'rose' },
  { key: 'deliveredLate', label: 'Entregue com atraso', tone: 'amber' },
  { key: 'pending', label: 'Pendente no prazo', tone: 'blue' },
  { key: 'validation', label: 'A validar', tone: 'slate' },
] as const;

export function SemesterEvolution({ points, loading, error, onRetry, onSelect, range, onRangeChange }: {
  points: SemesterPoint[]; loading: boolean; error: string | null; onRetry: () => void; onSelect: (id: string) => void;
  range: EvolutionDateRange; onRangeChange: (range: EvolutionDateRange) => void;
}) {
  const id = useId(); const tooltip = useChartTooltip();
  const [draft, setDraft] = useState(range);
  const rangeError = evolutionRangeError(draft);
  const width = Math.max(620, points.length * 48 + 90); const left = 48; const right = width - 35; const bottom = 218; const plotHeight = 170;
  const { ceiling, ticks } = integerScale(points.map((point) => point.total));
  const step = (right - left) / Math.max(1, points.length);
  const x = (index: number) => left + (index + .5) * step;
  const y = (value: number) => bottom - value / ceiling * plotHeight;
  const hasRange = Boolean(range.dateFrom || range.dateTo);
  return <section className="ned-panel executive-evolution" aria-labelledby={id} aria-busy={loading}>
    <header className="ned-panel-heading"><h2 id={id}>Evolução das entregas</h2><p>Quantidade de itens por situação ao longo das coletas</p></header>
    <form className="executive-evolution-filters" aria-label="Período da evolução das entregas" aria-describedby={id + '-help'} onSubmit={(event) => { event.preventDefault(); if (!rangeError) { tooltip.hide(); onRangeChange({ ...draft }); } }}>
      <label><span>Data inicial</span><input type="date" value={draft.dateFrom} max={draft.dateTo || undefined} aria-invalid={Boolean(rangeError)} aria-describedby={rangeError ? id + '-error' : undefined} onChange={(event) => setDraft((current) => ({ ...current, dateFrom: event.target.value }))} /></label>
      <label><span>Data final</span><input type="date" value={draft.dateTo} min={draft.dateFrom || undefined} aria-invalid={Boolean(rangeError)} aria-describedby={rangeError ? id + '-error' : undefined} onChange={(event) => setDraft((current) => ({ ...current, dateTo: event.target.value }))} /></label>
      <button type="submit" className="primary-button" disabled={loading || Boolean(rangeError)}>Aplicar</button>
      <button type="button" className="secondary-button" disabled={loading || !hasRange && !draft.dateFrom && !draft.dateTo} onClick={() => { const empty = { dateFrom: '', dateTo: '' }; setDraft(empty); tooltip.hide(); onRangeChange(empty); }}>Limpar</button>
      <p id={id + '-help'}>Filtra somente as datas das coletas deste gráfico · horário de Brasília.</p>
      {rangeError && <p id={id + '-error'} className="executive-evolution-error" role="alert">{rangeError}</p>}
    </form>
    {error ? <div className="executive-chart-message" role="status"><p>{error}</p><button type="button" className="secondary-button" onClick={onRetry}>Recarregar evolução</button></div>
      : loading ? <div className="executive-chart-message" role="status">Carregando histórico do período…</div>
      : !points.length ? <div className="executive-chart-message" role="status"><strong>Nenhuma coleta comparável neste período</strong><p>{hasRange ? 'Ajuste as datas ou use Limpar para consultar o histórico disponível.' : 'O histórico aparece conforme o NED atualiza os dados. Nenhuma evolução é estimada.'}</p></div>
      : <>
        <p className="executive-evolution-caption" role="status">{points.length} {points.length === 1 ? 'coleta' : 'coletas'} · {formatDate(points[0].generatedAt)}{points.length > 1 && ' a ' + formatDate(points.at(-1)!.generatedAt)}{points.length === 1 && ' · outra coleta é necessária para mostrar uma evolução.'}</p>
        <div className="ned-plot-scroll" role="region" aria-label="Gráfico de barras empilhadas da evolução das entregas; role horizontalmente" tabIndex={0}><svg width={width} height={274} viewBox={`0 0 ${width} 274`} role="group" aria-labelledby={id} aria-describedby={id + '-chart-help'}>
          <desc id={id + '-chart-help'}>Cada barra representa uma coleta. As cores separam situações de entrega que não se sobrepõem. O eixo vertical indica itens; o horizontal, a data de cada coleta. Foque uma barra para consultar os valores ou pressione Enter para abrir a referência.</desc>
          <text x={left} y={24} className="ned-axis-label">Itens</text>
          {ticks.map((tick) => <g key={tick} aria-hidden="true"><line x1={left} x2={right} y1={y(tick)} y2={y(tick)} className="ned-plot-grid" /><text x={left - 8} y={y(tick) + 4} textAnchor="end" className="ned-axis-label">{tick.toLocaleString('pt-BR')}</text></g>)}
          {points.map((point, index) => {
            let offset = 0;
            const content = { title: 'Coleta de ' + formatDate(point.generatedAt), lines: [...series.map((item) => ({ label: item.label, value: point[item.key].toLocaleString('pt-BR') })), { label: 'Total de itens', value: point.total.toLocaleString('pt-BR') }], hint: 'Clique ou pressione Enter para abrir esta referência.' };
            return <g {...tooltip.bind(point.snapshotId, content)} key={point.snapshotId} role="button" tabIndex={0} className="ned-chart-pick" aria-label={content.title + '. ' + content.lines.map((line) => line.label + ': ' + line.value).join('; ') + '. Abrir referência.'} onClick={() => { tooltip.hide(); onSelect(point.snapshotId); }} onKeyDown={(event) => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); tooltip.hide(); onSelect(point.snapshotId); } }}>
              <rect x={x(index) - step / 2 + 2} y={24} width={Math.max(1, step - 4)} height={214} className="ned-chart-target" />
              {series.map((item) => {
                const height = point[item.key] / ceiling * plotHeight;
                const top = bottom - offset - height; offset += height;
                return <rect key={item.key} x={x(index) - Math.min(step * .3, 16)} y={top} width={Math.min(step * .6, 32)} height={height} fill={CHART_COLORS[item.tone]} aria-hidden="true" />;
              })}
              <text x={x(index)} y={y(point.total) - 8} textAnchor="middle" className="ned-bar-value" aria-hidden="true">{point.total.toLocaleString('pt-BR')}</text>
              <text x={x(index)} y={bottom + 22} textAnchor="middle" className="ned-axis-label" aria-hidden="true">{formatDate(point.generatedAt).slice(0, 5)}</text>
            </g>;
          })}
          <text x={(left + right) / 2} y={262} textAnchor="middle" className="ned-axis-label">Data da coleta</text>
        </svg></div>
        <div className="ned-chart-legend">{series.map((item) => <span key={item.key}><i style={{ background: CHART_COLORS[item.tone] }} aria-hidden="true" />{item.label}</span>)}</div>
      </>}
    <p className="ned-panel-note">Até 26 referências semanais comparáveis no período, até a coleta do panorama. Cada barra reúne os estados da coleta, sem sobreposição. A quantidade de itens pode mudar entre coletas.</p>
    <ChartTooltip {...tooltip.props} />
  </section>;
}
