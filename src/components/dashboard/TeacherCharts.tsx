import { useEffect, useRef, useState } from 'react';
import { teacherChartData } from '@/lib/dashboardView';
import type { RankingData, RankingEntry } from '@/types/dashboard';

type TeacherDatum = ReturnType<typeof teacherChartData>['all'][number];
type Metric = 'late' | 'onTime' | 'days';
const number = (value: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value);
const shortName = (name: string) => { const words = name.split(' '); return words.length > 2 ? words[0] + ' ' + words.at(-1) : name; };
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
  const width = Math.max(multiple ? 920 : 560, measured, items.length * 88 + 90);
  const plotHeight = multiple ? 130 : 190;
  const gap = multiple ? 55 : 0;
  const height = metrics.length * (plotHeight + gap) + 85;
  const left = 50; const right = 22;
  const step = (width - left - right) / items.length;
  const barWidth = Math.min(42, step * .5);
  const limits = metrics.map((metric) => metric.key === 'days' ? Math.max(20, Math.ceil(Math.max(0, ...items.map((item) => item.days ?? 0)) / 5) * 5) : 100);
  const bottom = 36 + metrics.length * plotHeight + (metrics.length - 1) * gap;
  const description = (item: TeacherDatum) => metrics.map((metric) => metric.label + ': ' + (item[metric.key] == null ? 'sem base confirmada' : number(item[metric.key]!) + unit(metric.key))).join('; ') + (item.entry.never ? '; ' + item.entry.never + ' disciplina(s) sem acesso registrado' : '');
  return <div ref={frame} className="chart-scroll" role="region" aria-label="Gráfico de docentes; role horizontalmente para ver todos" tabIndex={0}>
    <svg className="teacher-plot" viewBox={'0 0 ' + width + ' ' + height} width={width} height={height} aria-label={metrics.map((metric) => metric.label).join(' e ')}>
      {metrics.map((metric, index) => {
        const top = 36 + index * (plotHeight + gap);
        return <g key={metric.key} aria-hidden="true">
          <text x={left} y={top - 17} className="axis-heading">{metric.label} ({metric.key === 'days' ? 'dias' : '%'})</text>
          {[0, 1, 2, 3, 4].map((tick) => {
            const y = top + plotHeight - tick * plotHeight / 4;
            return <g key={tick}><line x1={left} x2={width - right} y1={y} y2={y} className="plot-grid" /><text x={left - 9} y={y + 4} textAnchor="end" className="axis-tick">{number(tick * limits[index] / 4)}</text></g>;
          })}
          {metric.key === 'days' && <line x1={left} x2={width - right} y1={top + plotHeight - 7 / limits[index] * plotHeight} y2={top + plotHeight - 7 / limits[index] * plotHeight} className="access-threshold" />}
        </g>;
      })}
      {items.map((item, index) => {
        const center = left + step * (index + .5);
        return <g key={item.entry.teacher.id} className="chart-pick" role="button" tabIndex={0} aria-label={'Consultar ' + item.name + '. ' + description(item)} onClick={() => onSelect(item.entry)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(item.entry); } }}>
          <title>{item.name + '\n' + description(item)}</title>
          <rect className="chart-target" x={center - step / 2 + 2} y={18} width={step - 4} height={bottom + 12} rx={5} />
          {metrics.map((metric, metricIndex) => {
            const value = item[metric.key];
            const base = 36 + metricIndex * (plotHeight + gap) + plotHeight;
            const barHeight = value == null ? 0 : value / limits[metricIndex] * plotHeight;
            const missingAccess = metric.key === 'days' && item.entry.never > 0;
            return <g key={metric.key} aria-hidden="true">
              {value != null && <rect x={center - barWidth / 2} y={base - Math.max(barHeight, 2)} width={barWidth} height={Math.max(barHeight, 2)} rx={3} fill={metric.color} />}
              <text x={center} y={value == null ? base - 10 : base - barHeight - 9} textAnchor="middle" className="bar-number">{value == null ? metric.key === 'days' && item.entry.activeCourses ? 's/registro' : 's/base' : number(value) + unit(metric.key) + (missingAccess ? '*' : '')}</text>
            </g>;
          })}
          <text x={center} y={bottom + 25} textAnchor="middle" className="teacher-axis-name" aria-hidden="true">{shortName(item.name).slice(0, 15)}</text>
        </g>;
      })}
    </svg>
  </div>;
}

export function TeacherCharts({ data, onTeacher }: { data: RankingData; onTeacher: (entry: RankingEntry) => void }) {
  const teachers = teacherChartData(data.teachers);
  const charts = [
    { id: 'late', title: 'Top 10 · mais atrasos', subtitle: 'Entregas tardias + pendências vencidas · % por disciplina', items: teachers.late, metric: { key: 'late' as const, label: 'Atrasos', color: '#d43d53' } },
    { id: 'ontime', title: 'Top 10 · mais entregas no prazo', subtitle: 'Prazos encerrados · % por disciplina', items: teachers.onTime, metric: { key: 'onTime' as const, label: 'No prazo', color: '#15966c' } },
    { id: 'absent', title: 'Top 10 · maior ausência', subtitle: '8+ dias ou sem registro · maior intervalo ativo', items: teachers.absent, metric: { key: 'days' as const, label: 'Sem acesso', color: '#bc6d16' } },
    { id: 'present', title: 'Top 10 · acessos mais recentes', subtitle: 'Menor intervalo · todas as disciplinas ativas com registro', items: teachers.present, metric: { key: 'days' as const, label: 'Sem acesso', color: '#267bc2' } },
  ];
  return <>
    <section className="chart-panel chart-wide" aria-labelledby="panorama-title">
      <header className="chart-heading"><div><h2 id="panorama-title">Panorama geral dos docentes</h2><p>Atrasos (%) e dias sem acesso · escalas separadas</p></div><span className="chart-count">{teachers.all.length} docentes</span></header>
      <Columns items={teachers.all} metrics={[{ key: 'late', label: 'Atrasos', color: '#d43d53' }, { key: 'days', label: 'Sem acesso', color: '#267bc2' }]} onSelect={onTeacher} />
      <div className="chart-footnote"><span>Clique no docente para abrir suas atividades.</span><span>* Há disciplina sem registro · s/base: dados insuficientes</span></div>
    </section>
    {charts.map((chart) => <section key={chart.id} className="chart-panel" aria-labelledby={chart.id + '-title'}><header className="chart-heading"><div><h2 id={chart.id + '-title'}>{chart.title}</h2><p>{chart.subtitle}</p></div><span className="series-dot" style={{ background: chart.metric.color }} aria-hidden="true" /></header><Columns items={chart.items} metrics={[chart.metric]} onSelect={onTeacher} />{chart.metric.key === 'days' && <div className="chart-footnote"><span>0–7 em dia · 8–14 atenção · 15+ crítico</span><span>* Inclui disciplina sem registro</span></div>}</section>)}
  </>;
}
