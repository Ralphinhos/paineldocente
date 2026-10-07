import { useState } from 'react';
import { ArrowDownUp, ArrowUpRight, Search } from 'lucide-react';
import { deliveryPercent } from '@/lib/dashboardView';
import type { RankingData, RankingEntry } from '@/types/dashboard';

const number = (value: number | null, suffix = '') => value == null ? '—' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value) + suffix;
const modes = { COMPOSITE: 'Nota geral', INCOMPLETE: 'A validar', ACCESS_ONLY: 'Somente acesso', DELIVERY_ONLY: 'Somente entregas', NO_BASIS: 'Sem base' };
type Sort = 'name' | 'score' | 'days' | 'onTime' | 'late' | 'delay' | 'overdue';
function sortValue(entry: RankingEntry, key: Sort): string | number | null {
  switch (key) {
    case 'name': return entry.teacher.name;
    case 'score': return entry.score;
    case 'days': return entry.activeCourses ? entry.maxDaysSinceAccess : null;
    case 'onTime': return deliveryPercent(entry);
    case 'late': { const percent = deliveryPercent(entry); return percent == null ? null : 100 - percent; }
    case 'delay': return ['COMPOSITE', 'DELIVERY_ONLY'].includes(entry.mode) ? entry.averageDaysLate : null;
    case 'overdue': return entry.overdue;
  }
}

export function TeacherPerformanceTable({ data, onSelect }: { data: RankingData; onSelect: (entry: RankingEntry) => void }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: Sort; ascending: boolean }>({ key: 'score', ascending: false });
  const rows = data.teachers.filter((entry) => entry.teacher.name.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))).sort((a, b) => {
    const one = sortValue(a, sort.key); const two = sortValue(b, sort.key);
    if (one == null || two == null) return one == null && two == null ? a.teacher.name.localeCompare(b.teacher.name, 'pt-BR') : one == null ? 1 : -1;
    const difference = typeof one === 'string' ? one.localeCompare(String(two), 'pt-BR') : one - Number(two);
    return difference * (sort.ascending ? 1 : -1) || a.teacher.name.localeCompare(b.teacher.name, 'pt-BR');
  });
  const heading = (key: Sort, label: string) => <th scope="col" aria-sort={sort.key === key ? sort.ascending ? 'ascending' : 'descending' : 'none'}><button type="button" onClick={() => setSort({ key, ascending: sort.key === key ? !sort.ascending : key === 'name' })}>{label}<ArrowDownUp size={12} aria-hidden="true" /></button></th>;
  return <section className="data-section chart-wide" aria-labelledby="performance-title">
    <div className="section-heading"><div><h2 id="performance-title">Tabela de desempenho · todos os docentes</h2></div><label className="table-search"><Search size={16} aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Buscar docente na tabela de desempenho" placeholder="Buscar docente…" /></label></div>
    <div className="table-wrap performance-wrap" role="region" aria-label="Desempenho docente; role horizontalmente para consultar todas as colunas" tabIndex={0}><table className="performance-table"><thead><tr>{heading('name', 'Docente')}{heading('score', 'Nota /100')}{heading('days', 'Dias sem acesso')}{heading('onTime', '% no prazo')}{heading('late', '% com atraso')}{heading('delay', 'Atraso médio (dias)')}{heading('overdue', 'Pendentes vencidas')}<th scope="col">Base</th></tr></thead>
      <tbody>{rows.map((entry) => {
        const onTime = deliveryPercent(entry);
        return <tr key={entry.teacher.id}>
          <td><button className="text-action teacher-link" type="button" onClick={() => onSelect(entry)}>{entry.teacher.name}<ArrowUpRight size={14} aria-hidden="true" /></button><small>{entry.courseCount} disciplina{entry.courseCount === 1 ? '' : 's'}</small></td>
          <td className="numeric-cell"><strong className={'score-value ' + (entry.score == null ? 'score-unknown' : entry.score >= 90 ? 'score-good' : entry.score >= 60 ? 'score-attention' : 'score-critical')}>{number(entry.score)}</strong></td>
          <td className="numeric-cell"><span className={entry.never || (entry.maxDaysSinceAccess ?? 0) >= 15 ? 'text-danger' : (entry.maxDaysSinceAccess ?? 0) >= 8 ? 'text-warning' : ''}>{number(entry.activeCourses ? entry.maxDaysSinceAccess : null)}</span>{entry.never > 0 && <small className="text-danger">{entry.never} sem registro</small>}</td>
          <td className="numeric-cell">{number(onTime, '%')}</td><td className="numeric-cell">{number(onTime == null ? null : 100 - onTime, '%')}</td><td className="numeric-cell">{number(['COMPOSITE', 'DELIVERY_ONLY'].includes(entry.mode) ? entry.averageDaysLate : null)}</td>
          <td className="numeric-cell">{entry.overdue}</td><td><span className={'delivery-label delivery-' + (entry.mode === 'COMPOSITE' ? 'success' : 'muted')}>{modes[entry.mode]}</span></td>
        </tr>;
      })}{!rows.length && <tr><td colSpan={8} className="table-empty">Nenhum docente encontrado. Limpe a busca para ver todos.</td></tr>}</tbody>
    </table></div>
    <div className="chart-footnote"><span>% por disciplina com prazo encerrado · atraso inclui pendências vencidas</span><span>Acesso: maior intervalo ativo · — sem base confirmada</span></div>
  </section>;
}
