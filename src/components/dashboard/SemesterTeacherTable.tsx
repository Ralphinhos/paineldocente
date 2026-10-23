import { ArrowUpRight, Search } from 'lucide-react';
import { MonitoringPagination } from './MonitoringPagination';
import { detailHref } from '@/lib/workspace';
import { formatPercent } from '@/lib/monitoringCharts';
import type { ExecutiveData, ExecutiveFilters } from '@/types/executive';

const accessLabel = (status: string, days: number | null) => status === 'NOT_VERIFIABLE' ? 'A validar' : status === 'NEVER' ? 'Sem registro' : `${days} dia${days === 1 ? '' : 's'}`;
export function SemesterTeacherTable({ data, query, sort, disabled, onQuery, onSort, onPage }: {
  data: ExecutiveData; query: string; sort: ExecutiveFilters['sort']; disabled: boolean;
  onQuery: (value: string) => void; onSort: (value: ExecutiveFilters['sort']) => void; onPage: (page: number) => void;
}) {
  return <section className="ned-panel executive-teachers" aria-labelledby="semester-teachers-title" aria-busy={disabled}>
    <header className="list-heading"><div><h2 id="semester-teachers-title">Panorama por docente</h2><p>Consulte os percentuais e as pendências de cada docente</p></div>
      <div className="executive-table-controls"><label className="executive-search"><Search size={16} aria-hidden="true" /><span className="sr-only">Buscar docente na tabela</span><input type="search" value={query} maxLength={200} placeholder="Buscar docente" onChange={(event) => onQuery(event.target.value)} /></label>
        <label><span className="sr-only">Ordenar docentes</span><select value={sort} disabled={disabled} onChange={(event) => onSort(event.target.value as ExecutiveFilters['sort'])}><option value="late">Mais atrasos</option><option value="ontime">Mais no prazo</option><option value="access">Mais dias sem acesso</option><option value="name">Nome do docente</option></select></label>
      </div>
    </header>
    <div className="monitoring-table-wrap"><table className="monitoring-table executive-performance-table"><thead><tr><th scope="col">Docente</th><th scope="col">Último acesso</th><th scope="col">No prazo</th><th scope="col">Com atraso</th><th scope="col">Pendentes vencidas</th><th scope="col">Maior atraso aberto</th><th scope="col"><span className="sr-only">Detalhar</span></th></tr></thead>
      <tbody>{data.teachers.rows.map((row) => {
        const href = detailHref(data.meta, { teacherId: row.teacher.id, section: 'deliveries' });
        return <tr key={row.teacher.id}><td><a href={href} className="teacher-name">{row.teacher.name}</a><small>{row.courses} disciplina(s) · {row.due} prazo(s) encerrado(s)</small></td>
          <td><span className={'executive-access access-' + row.access.status.toLowerCase()}>{accessLabel(row.access.status, row.access.daysSinceAccess)}</span></td>
          <td><div className="executive-table-proportion"><strong>{formatPercent(row.onTimePercent)}</strong>{row.onTimePercent != null && <span className="executive-mini-bar" aria-hidden="true"><i style={{ width: row.onTimePercent + '%', background: '#24a572' }} /></span>}<small>{row.onTimeDue} de {row.due}</small></div></td>
          <td><div className="executive-table-proportion"><strong>{formatPercent(row.latePercent)}</strong>{row.latePercent != null && <span className="executive-mini-bar" aria-hidden="true"><i style={{ width: row.latePercent + '%', background: '#e65f7d' }} /></span>}<small>{row.lateDue} de {row.due}</small></div></td>
          <td>{row.overdue}<small>{row.deliveredLate} resolvida(s) com atraso</small></td><td>{row.overdue ? row.maxOpenDays + ' dias' : '—'}</td><td><a className="icon-button" href={href} aria-label={'Detalhar ' + row.teacher.name}><ArrowUpRight size={17} aria-hidden="true" /></a></td></tr>;
      })}</tbody>
    </table>{!data.teachers.rows.length && <div className="ned-chart-empty"><strong>Nenhum docente encontrado</strong><span>Limpe a busca ou selecione outro recorte.</span></div>}</div>
    <MonitoringPagination value={data.teachers.pagination} disabled={disabled} onChange={onPage} />
    <p className="ned-panel-note">Percentuais sobre prazos encerrados e verificáveis. Entregas futuras e dispensas não reduzem a proporção de atrasos; responsáveis não confirmados ficam fora das comparações.</p>
  </section>;
}
