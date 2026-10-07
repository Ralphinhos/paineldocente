import { formatDate } from '@/lib/presentation';
import type { DashboardData, VisualSelection } from '@/types/dashboard';

const series = [
  { key: 'delivered' as const, label: 'Entregues', color: '#15966c', dash: undefined },
  { key: 'pending' as const, label: 'Pendentes', color: '#667589', dash: '5 5' },
  { key: 'deliveredLate' as const, label: 'Entregues com atraso', color: '#bc6d16', dash: undefined },
];

export function DeliveryCharts({ data, onSelect }: { data: DashboardData; onSelect: (selection: VisualSelection) => void }) {
  const points = data.trend;
  const width = 880; const height = 270; const left = 46; const right = 24; const top = 28; const bottom = 220;
  const maximum = Math.max(4, Math.ceil(Math.max(0, ...points.flatMap((point) => series.map((item) => point[item.key]))) / 4) * 4);
  const x = (index: number) => points.length < 2 ? (width + left - right) / 2 : left + index / (points.length - 1) * (width - left - right);
  const y = (value: number) => bottom - value / maximum * (bottom - top);
  const activities = data.visuals.activities.filter((item) => item.overdue + item.deliveredLate > 0).slice(0, 10);
  const largest = Math.max(1, ...activities.map((item) => item.overdue + item.deliveredLate));
  return <>
    <section className="chart-panel chart-wide" aria-labelledby="evolution-title">
      <header className="chart-heading"><div><h2 id="evolution-title">Evolução do andamento</h2><p>Por data de relatório · quantidade de atividades</p></div><span className="chart-count">{points.length} semana{points.length === 1 ? '' : 's'}</span></header>
      <div className="chart-legend">{series.map((item) => <span key={item.key}><i style={{ background: item.color }} />{item.label}</span>)}</div>
      {points.length ? <div className="chart-scroll"><svg className="trend-plot" viewBox={'0 0 ' + width + ' ' + height} role="img" aria-label="Evolução semanal das entregas. Os valores exatos estão na tabela de dados deste gráfico.">
        {[0, 1, 2, 3, 4].map((tick) => <g key={tick} aria-hidden="true"><line x1={left} x2={width - right} y1={y(maximum * tick / 4)} y2={y(maximum * tick / 4)} className="plot-grid" /><text x={left - 10} y={y(maximum * tick / 4) + 4} textAnchor="end" className="axis-tick">{maximum * tick / 4}</text></g>)}
        {series.map((item) => <g key={item.key}>{points.length > 1 && <polyline points={points.map((point, index) => x(index) + ',' + y(point[item.key])).join(' ')} fill="none" stroke={item.color} strokeWidth={3} strokeDasharray={item.dash} />}{points.map((point, index) => <g key={point.generatedAt}><circle cx={x(index)} cy={y(point[item.key])} r={5} fill={item.color}><title>{formatDate(point.generatedAt) + ' · ' + item.label + ': ' + point[item.key]}</title></circle><text x={x(index) + (points.length === 1 ? 14 : 0)} y={y(point[item.key]) - 10} textAnchor={points.length === 1 ? 'start' : 'middle'} className="bar-number" fill={item.color}>{point[item.key]}</text></g>)}</g>)}
        {points.map((point, index) => <text key={point.generatedAt} x={x(index)} y={bottom + 28} textAnchor="middle" className="axis-tick">{formatDate(point.generatedAt).slice(0, 5)}</text>)}
      </svg></div> : <div className="chart-empty"><strong>Nenhuma coleta histórica disponível</strong><span>Atualize os dados para registrar a primeira semana.</span></div>}
      <div className="chart-footnote"><span>{points.length === 1 ? 'Primeira semana registrada. As próximas coletas formarão a curva.' : 'Entregas com atraso fazem parte do total entregue.'}</span><span>{points.at(-1)?.notVerifiable ? points.at(-1)!.notVerifiable + ' atividades a validar na última coleta' : 'Mesmas regras, modalidade e período'}</span></div>
      <details className="chart-data"><summary>Ver dados do gráfico</summary><div className="table-wrap"><table><thead><tr><th>Coleta</th><th>Entregues</th><th>Pendentes</th><th>Entregues com atraso</th><th>A validar</th></tr></thead><tbody>{points.map((point) => <tr key={point.generatedAt}><td>{formatDate(point.generatedAt)}</td><td>{point.delivered}</td><td>{point.pending}</td><td>{point.deliveredLate}</td><td>{point.notVerifiable}</td></tr>)}</tbody></table></div></details>
    </section>
    <section className="chart-panel chart-wide" aria-labelledby="activity-chart-title">
      <header className="chart-heading"><div><h2 id="activity-chart-title">Top 10 atividades com mais atrasos</h2><p>Por modalidade · quantidade de itens</p></div></header>
      <div className="chart-legend"><span><i className="legend-overdue" />Pendente em atraso</span><span><i className="legend-late" />Entregue com atraso</span></div>
      <div className="horizontal-chart">{activities.map((item) => {
        const total = item.overdue + item.deliveredLate;
        return <button className="activity-bar-row" type="button" key={item.key} onClick={() => onSelect({ label: item.modalityLabel + ' · ' + item.label, status: 'OVERDUE,DELIVERED_LATE', requirementId: item.requirementId, requirementGroup: item.requirementGroup, modality: item.modality })} aria-label={item.modalityLabel + ' · ' + item.label + ': ' + item.overdue + ' pendentes em atraso e ' + item.deliveredLate + ' entregues com atraso. Consultar atividades.'}>
          <span><small>{item.modalityLabel}</small><b>{item.label}</b></span><div className="horizontal-track" aria-hidden="true"><i className="legend-overdue" style={{ width: item.overdue / largest * 100 + '%' }} /><i className="legend-late" style={{ width: item.deliveredLate / largest * 100 + '%' }} /></div><strong>{total}</strong>
        </button>;
      })}{!activities.length && <div className="chart-empty"><strong>Nenhuma atividade com atraso</strong><span>Dados a validar não entram neste gráfico.</span></div>}</div>
      <div className="chart-footnote"><span>Clique na barra para conferir os prazos e as entregas.</span></div>
    </section>
  </>;
}
