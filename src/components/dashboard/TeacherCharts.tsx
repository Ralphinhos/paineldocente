import { useEffect, useRef, useState } from 'react';
import { teacherChartData } from '@/lib/dashboardView';
import type { RankingData, RankingEntry } from '@/types/dashboard';

type TeacherDatum = ReturnType<typeof teacherChartData>['all'][number];
type Metric = 'late' | 'onTime' | 'days';
const number = (value: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value);
const shortName = (name: string) => { const cleaned = name.replace(/\s*\(demo\)$/i, ''); const words = cleaned.split(/\s+/); return words.length > 2 ? words[0] + ' ' + words.at(-1) : cleaned; };
const unit = (metric: Metric) => metric === 'days' ? 'd' : '%';

function Columns({ items, metrics, onSelect }: { items: TeacherDatum[]; metrics: Array<{ key: Metric; label: string; color: string }>; onSelect: (entry: RankingEntry) => void }) {
  const frame = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState(0);
  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    const observer = new ResizeObserver(([size]) => setMeasured(Math.floor(size.contentRect.width)));
    observer.observe(node);
    return () => observer.disconnect();
  }, [items.length]);
  if (!items.length) return <div className="chart-empty"><strong>Nenhum docente nesta situação</strong><span>Os filtros e os prazos encerrados definem a base.</span></div>;
  const multiple = metrics.length > 1;
  const width = Math.max(multiple ? 920 : 560, measured, items.length * 96 + 120);
  const plotHeight = 224;
  const height = 374;
  const top = 44;
  const left = 60; const right = multiple ? 60 : 28;
  const step = (width - left - right) / items.length;
  const barWidth = Math.min(multiple ? 24 : 42, step * (multiple ? .25 : .5));
  const limits = metrics.map((metric) => metric.key === 'days' ? Math.max(20, Math.ceil(Math.max(0, ...items.map((item) => item.days ?? 0)) / 5) * 5) : 100);
  const bottom = top + plotHeight;
  const description = (item: TeacherDatum) => metrics.map((metric) => metric.label + ': ' + (item[metric.key] == null ? 'sem base confirmada' : number(item[metric.key]!) + unit(metric.key))).join('; ') + (item.entry.never ? '; ' + item.entry.never + ' disciplina(s) sem acesso registrado' : '');
  return <div ref={frame} className="chart-scroll" role="region" aria-label="Gráfico de docentes; role horizontalmente para ver todos" tabIndex={0}>
    <svg className="teacher-plot" viewBox={'0 0 ' + width + ' ' + height} width={width} height={height} aria-label={metrics.map((metric) => metric.label).join(' e ')}>
      <g aria-hidden="true">
        {[0, 1, 2, 3, 4].map((tick) => {
          const y = bottom - tick * plotHeight / 4;
          return <line key={tick} x1={left} x2={width - right} y1={y} y2={y} className="plot-grid" />;
        })}
        {metrics.map((metric, index) => {
          const secondary = index > 0;
          const axisX = secondary ? width - right + 9 : left - 9;
          return <g key={metric.key}>
            <text x={secondary ? width - right : left} y={top - 22} textAnchor={secondary ? 'end' : 'start'} className="axis-heading">{metric.label} ({metric.key === 'days' ? 'dias' : '%'})</text>
            {[0, 1, 2, 3, 4].map((tick) => <text key={tick} x={axisX} y={bottom - tick * plotHeight / 4 + 4} textAnchor={secondary ? 'start' : 'end'} className="axis-tick">{number(tick * limits[index] / 4)}</text>)}
            {!multiple && metric.key === 'days' && <line x1={left} x2={width - right} y1={bottom - 7 / limits[index] * plotHeight} y2={bottom - 7 / limits[index] * plotHeight} className="access-threshold" />}
          </g>;
        })}
      </g>
      {items.map((item, index) => {
        const center = left + step * (index + .5);
        return <g key={item.entry.teacher.id} className="chart-pick" role="button" tabIndex={0} aria-label={'Consultar ' + item.name + '. ' + description(item)} onClick={() => onSelect(item.entry)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(item.entry); } }}>
          <title>{item.name + '\n' + description(item)}</title>
          <rect className="chart-target" x={center - step / 2 + 2} y={top} width={step - 4} height={height - top - 8} rx={5} />
          {metrics.map((metric, metricIndex) => {
            const value = item[metric.key];
            const barHeight = value == null ? 0 : value / limits[metricIndex] * plotHeight;
            const metricX = center + (multiple ? (metricIndex === 0 ? -1 : 1) * (barWidth / 2 + 10) : 0);
            const missingAccess = metric.key === 'days' && item.entry.never > 0;
            return <g key={metric.key} aria-hidden="true">
              {value != null && value > 0 && <rect x={metricX - barWidth / 2} y={bottom - barHeight} width={barWidth} height={barHeight} rx={3} fill={metric.color} />}
              <text x={metricX} y={bottom - barHeight - 9} textAnchor="middle" className="bar-number">{value == null ? '—' : number(value) + unit(metric.key) + (missingAccess ? '*' : '')}</text>
            </g>;
          })}
          <text x={center + 8} y={bottom + 25} textAnchor="end" transform={'rotate(-32 ' + (center + 8) + ' ' + (bottom + 25) + ')'} className="teacher-axis-name" aria-hidden="true">{shortName(item.name).slice(0, 20)}</text>
        </g>;
      })}
    </svg>
  </div>;
}

export function TeacherCharts({ data, onTeacher }: { data: RankingData; onTeacher: (entry: RankingEntry) => void }) {
  const teachers = teacherChartData(data.teachers);
  const charts = [
    { id: 'late', title: 'Top 10 docentes: mais atrasos', subtitle: 'Entregas tardias e pendências vencidas · % por disciplina', items: teachers.late, metric: { key: 'late' as const, label: 'Atrasos', color: '#ef4444' } },
    { id: 'ontime', title: 'Top 10 docentes: mais no prazo', subtitle: 'Prazos encerrados · % por disciplina', items: teachers.onTime, metric: { key: 'onTime' as const, label: 'No prazo', color: '#10b981' } },
    { id: 'absent', title: 'Top 10 docentes: mais ausentes', subtitle: '8+ dias ou sem registro · maior intervalo ativo', items: teachers.absent, metric: { key: 'days' as const, label: 'Sem acesso', color: '#f59e0b' } },
    { id: 'present', title: 'Top 10 docentes: mais acessam', subtitle: 'Menor intervalo nas disciplinas ativas', items: teachers.present, metric: { key: 'days' as const, label: 'Sem acesso', color: '#3b82f6' } },
  ];
  return <>
    <section className="chart-panel chart-wide" aria-labelledby="panorama-title">
      <header className="chart-heading"><div><h2 id="panorama-title">Panorama geral: atrasos × dias sem acesso</h2><p>Todos os docentes · % à esquerda e dias à direita</p></div><span className="chart-count">{teachers.all.length} docentes</span></header>
      <div className="chart-legend"><span><i style={{ background: '#ef4444' }} />% de atrasos</span><span><i style={{ background: '#3b82f6' }} />Dias sem acesso</span></div>
      <Columns items={teachers.all} metrics={[{ key: 'late', label: 'Atrasos', color: '#ef4444' }, { key: 'days', label: 'Sem acesso', color: '#3b82f6' }]} onSelect={onTeacher} />
      <div className="chart-footnote"><span>Clique no docente para conferir as atividades.</span><span>— sem base confirmada · * disciplina sem acesso registrado</span></div>
    </section>
    {charts.map((chart) => <section key={chart.id} className="chart-panel" aria-labelledby={chart.id + '-title'}><header className="chart-heading"><div><h2 id={chart.id + '-title'}>{chart.title}</h2><p>{chart.subtitle}</p></div><span className="series-dot" style={{ background: chart.metric.color }} aria-hidden="true" /></header><Columns items={chart.items} metrics={[chart.metric]} onSelect={onTeacher} />{chart.metric.key === 'days' && <div className="chart-footnote"><span>0–7 em dia · 8–14 atenção · 15+ crítico</span><span>* Inclui disciplina sem registro</span></div>}</section>)}
  </>;
}
