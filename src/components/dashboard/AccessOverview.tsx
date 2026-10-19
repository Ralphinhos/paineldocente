import { ArrowRight, CheckCircle2, Clock3, TriangleAlert, Users } from 'lucide-react';
import { formatDate } from '@/lib/presentation';
import { MonitoringChart, type ChartTone } from './MonitoringChart';
import { MonitoringMetrics } from './MonitoringMetrics';
import { MonitoringPagination } from './MonitoringPagination';
import type { EnvironmentStatus, MonitoringData, MonitoringFilters } from '@/types/monitoring';

const labels: Record<EnvironmentStatus, string> = { CURRENT: 'Em dia', ATTENTION: 'Atenção', CRITICAL: 'Crítico', NEVER: 'Sem acesso registrado', NOT_VERIFIABLE: 'A validar' };
const tones: Record<EnvironmentStatus, string> = { CURRENT: 'success', ATTENTION: 'warning', CRITICAL: 'danger', NEVER: 'danger', NOT_VERIFIABLE: 'muted' };
const chartTones: Record<EnvironmentStatus, ChartTone> = { CURRENT: 'green', ATTENTION: 'amber', CRITICAL: 'rose', NEVER: 'purple', NOT_VERIFIABLE: 'slate' };
interface Props { data: MonitoringData['access']; filters: MonitoringFilters; disabled: boolean; onChange: (filters: MonitoringFilters) => void; onTeacher: (id: string) => void; onDeliveries: (id: string) => void }

export function AccessOverview({ data, filters, disabled, onChange, onTeacher, onDeliveries }: Props) {
  const { summary } = data;
  const choose = (accessStatus: MonitoringFilters['accessStatus']) => onChange({ ...filters, accessStatus, page: 1 });
  return <div className="monitoring-view">
    <MonitoringMetrics label="Situação dos acessos ao ambiente" disabled={disabled} metrics={[
      { label: 'Docentes analisados', value: summary.total, detail: 'Com disciplinas ativas no recorte', tone: 'blue', icon: Users, selected: filters.accessStatus === 'ALL', onClick: () => choose('ALL') },
      { label: 'Acessos em dia', value: summary.current, total: summary.total, detail: '0 a 7 dias sem acessar', tone: 'green', icon: CheckCircle2, selected: filters.accessStatus === 'CURRENT', onClick: () => choose('CURRENT') },
      { label: 'Acessos críticos', value: summary.critical, total: summary.total, detail: '15 dias ou mais sem acessar', tone: 'rose', icon: TriangleAlert, selected: filters.accessStatus === 'CRITICAL', onClick: () => choose('CRITICAL') },
      { label: 'Em atenção', value: summary.attention, total: summary.total, detail: '8 a 14 dias sem acessar', tone: 'amber', icon: Clock3, selected: filters.accessStatus === 'ATTENTION', onClick: () => choose('ATTENTION') },
    ]} />
    {(summary.never > 0 || summary.validation > 0) && <div className="validation-line">{summary.never > 0 && <button type="button" disabled={disabled} onClick={() => choose('NEVER')}>{summary.never} sem acesso registrado</button>}{summary.validation > 0 && <button type="button" disabled={disabled} onClick={() => choose('NOT_VERIFIABLE')}>{summary.validation} acesso(s) a validar</button>}</div>}
    <div className="monitoring-charts">
      <MonitoringChart title="Panorama dos acessos ao ambiente" description="Dias sem acessar o Moodle · maior intervalo primeiro" unit="dias sem acessar" disabled={disabled} onSelect={onTeacher} empty="Nenhum docente com disciplina ativa neste recorte." footnote="Todos os docentes do recorte. Clique em uma barra para filtrar o docente." legend={[{ label: 'Em dia · 0–7', tone: 'green' }, { label: 'Atenção · 8–14', tone: 'amber' }, { label: 'Crítico · 15+', tone: 'rose' }]} bars={data.panorama.map((row) => ({ id: row.teacher.id, label: row.teacher.name, value: row.daysSinceAccess, detail: labels[row.status], tone: chartTones[row.status], unavailableLabel: row.status === 'NEVER' ? 'Sem registro' : 'A validar' }))} />
      <MonitoringChart title="Situação dos docentes" description="Quantidade de docentes em cada faixa de acesso" unit="docentes" disabled={disabled} onSelect={(id) => choose(id as EnvironmentStatus)} empty="Nenhum docente neste recorte." footnote="Um registro por docente. Sem registro e a validar não contam como em dia." bars={summary.total ? [
        { id: 'CURRENT', label: 'Em dia', value: summary.current, detail: '0 a 7 dias', tone: 'green' },
        { id: 'ATTENTION', label: 'Atenção', value: summary.attention, detail: '8 a 14 dias', tone: 'amber' },
        { id: 'CRITICAL', label: 'Críticos', value: summary.critical, detail: '15 dias ou mais', tone: 'rose' },
        { id: 'NEVER', label: 'Sem registro', value: summary.never, detail: 'Sem acesso registrado', tone: 'purple' },
        { id: 'NOT_VERIFIABLE', label: 'A validar', value: summary.validation, detail: 'Dados a conferir', tone: 'slate' },
      ] : []} />
    </div>
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
