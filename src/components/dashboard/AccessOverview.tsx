import { ArrowRight } from 'lucide-react';
import { formatDate } from '@/lib/presentation';
import { MonitoringChart } from './MonitoringChart';
import { MonitoringPagination } from './MonitoringPagination';
import type { EnvironmentStatus, MonitoringData, MonitoringFilters } from '@/types/monitoring';

const labels: Record<EnvironmentStatus, string> = { CURRENT: 'Em dia', ATTENTION: 'Atenção', CRITICAL: 'Crítico', NEVER: 'Sem acesso registrado', NOT_VERIFIABLE: 'A validar' };
const tones: Record<EnvironmentStatus, string> = { CURRENT: 'success', ATTENTION: 'warning', CRITICAL: 'danger', NEVER: 'danger', NOT_VERIFIABLE: 'muted' };
interface Props { data: MonitoringData['access']; filters: MonitoringFilters; disabled: boolean; onChange: (filters: MonitoringFilters) => void; onTeacher: (id: string) => void; onDeliveries: (id: string) => void }

export function AccessOverview({ data, filters, disabled, onChange, onTeacher, onDeliveries }: Props) {
  const { summary } = data;
  const choose = (accessStatus: MonitoringFilters['accessStatus']) => onChange({ ...filters, accessStatus, page: 1 });
  return <div className="monitoring-view">
    <div className="view-context"><h2>Acesso ao ambiente Moodle</h2><span>{summary.total} docentes com disciplinas ativas</span></div>
    <div className="metric-strip">
      <button type="button" disabled={disabled} className="metric metric-danger" aria-pressed={filters.accessStatus === 'CRITICAL'} onClick={() => choose('CRITICAL')}><span>Críticos</span><strong>{summary.critical}</strong><small>15 dias ou mais sem acessar</small></button>
      <button type="button" disabled={disabled} className="metric metric-warning" aria-pressed={filters.accessStatus === 'ATTENTION'} onClick={() => choose('ATTENTION')}><span>Em atenção</span><strong>{summary.attention}</strong><small>8 a 14 dias sem acessar</small></button>
      <button type="button" disabled={disabled} className="metric metric-success" aria-pressed={filters.accessStatus === 'CURRENT'} onClick={() => choose('CURRENT')}><span>Em dia</span><strong>{summary.current}</strong><small>0 a 7 dias sem acessar</small></button>
    </div>
    {(summary.never > 0 || summary.validation > 0) && <div className="validation-line">{summary.never > 0 && <button type="button" disabled={disabled} onClick={() => choose('NEVER')}>{summary.never} sem acesso registrado</button>}{summary.validation > 0 && <button type="button" disabled={disabled} onClick={() => choose('NOT_VERIFIABLE')}>{summary.validation} acesso(s) a validar</button>}</div>}
    <MonitoringChart title="Quem está há mais tempo sem acessar?" unit="dias" disabled={disabled} onTeacher={onTeacher} empty="Nenhum intervalo em atenção ou crítico neste recorte." bars={data.chart.map((row) => ({ id: row.teacher.id, label: row.teacher.name, value: row.daysSinceAccess!, detail: labels[row.status], tone: row.status === 'CRITICAL' ? 'danger' : 'warning' }))} />
    <section className="occurrence-list" aria-labelledby="access-list-title">
      <header className="list-heading"><div><h2 id="access-list-title">Acompanhamento de acessos</h2><p>Um registro por docente · último acesso ao ambiente</p></div><div className="list-controls"><label><span className="sr-only">Situação do acesso</span><select value={filters.accessStatus} disabled={disabled} onChange={(event) => choose(event.target.value as MonitoringFilters['accessStatus'])}><option value="ISSUES">Atenção, críticos e a validar</option><option value="ALL">Todos os acessos</option><option value="CRITICAL">Críticos · 15+ dias</option><option value="ATTENTION">Atenção · 8–14 dias</option><option value="CURRENT">Em dia · 0–7 dias</option><option value="NEVER">Sem acesso registrado</option><option value="NOT_VERIFIABLE">A validar</option></select></label><button className="text-action" type="button" disabled={disabled} onClick={() => choose(filters.accessStatus === 'ALL' ? 'ISSUES' : 'ALL')}>{filters.accessStatus === 'ALL' ? 'Ver problemas' : 'Ver todos'}</button></div></header>
      {data.rows.length ? <div className="monitoring-table-wrap" tabIndex={0} role="region" aria-label="Lista de acessos; role para consultar todas as colunas"><table className="monitoring-table"><thead><tr><th>Docente</th><th>Último acesso ao Moodle</th><th className="numeric">Dias sem acessar</th><th>Situação</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{data.rows.map((row) => <tr key={row.teacher.id}>
        <td><button className="teacher-link" type="button" disabled={disabled} onClick={() => onTeacher(row.teacher.id)}>{row.teacher.name}</button><small>{row.courses.length} disciplina(s) ativa(s) neste recorte</small></td>
        <td>{formatDate(row.lastAccessAt, row.status === 'NEVER' ? 'Sem registro' : 'A validar')}</td><td className="numeric"><strong>{row.daysSinceAccess ?? '—'}</strong></td>
        <td><span className={'state-label state-' + tones[row.status]}>{labels[row.status]}</span></td><td><button className="text-action" type="button" disabled={disabled} onClick={() => onDeliveries(row.teacher.id)}>Ver entregas<ArrowRight size={15} /></button></td>
      </tr>)}</tbody></table></div> : <div className="empty-state"><strong>{summary.total ? 'Nenhum registro nesta seleção' : 'Nenhum docente com disciplina ativa neste recorte'}</strong><span>{summary.total && summary.current === summary.total ? 'Todos os docentes deste recorte estão em dia.' : 'Confira os filtros e a situação selecionada.'}</span></div>}
      <MonitoringPagination value={data.pagination} disabled={disabled} onChange={(page) => onChange({ ...filters, page })} />
    </section>
  </div>;
}
