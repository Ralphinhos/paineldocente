import { ArrowRight, CheckCircle2, Clock3, TriangleAlert, Users } from 'lucide-react';
import { formatDate } from '@/lib/presentation';
import { DistributionChart } from './DistributionChart';
import { MonitoringChart } from './MonitoringChart';
import { MonitoringMetrics } from './MonitoringMetrics';
import { MonitoringPagination } from './MonitoringPagination';
import type { ChartTone } from '@/lib/monitoringCharts';
import type { EnvironmentStatus, MonitoringData, MonitoringFilters } from '@/types/monitoring';

const labels: Record<EnvironmentStatus, string> = { CURRENT: 'Em dia', ATTENTION: 'Atenção', CRITICAL: 'Crítico', NEVER: 'Sem acesso registrado', NOT_VERIFIABLE: 'A validar' };
const tones: Record<EnvironmentStatus, string> = { CURRENT: 'success', ATTENTION: 'warning', CRITICAL: 'danger', NEVER: 'unknown', NOT_VERIFIABLE: 'muted' };
const chartTones: Record<EnvironmentStatus, ChartTone> = { CURRENT: 'green', ATTENTION: 'amber', CRITICAL: 'rose', NEVER: 'purple', NOT_VERIFIABLE: 'slate' };
interface Props { data: MonitoringData['access']; filters: MonitoringFilters; disabled: boolean; onChange: (filters: MonitoringFilters) => void; onTeacher: (id: string) => void; onDeliveries: (id: string) => void }

export function AccessOverview({ data, filters, disabled, onChange, onTeacher, onDeliveries }: Props) {
  const { summary: s } = data;
  const choose = (accessStatus: MonitoringFilters['accessStatus']) => onChange({ ...filters, accessStatus, page: 1 });
  const bars = data.panorama.slice(0, 10).map((row) => ({ id: row.teacher.id, label: row.teacher.name, value: row.daysSinceAccess, valueLabel: row.daysSinceAccess + 'd', detail: labels[row.status], tone: chartTones[row.status], unavailableLabel: row.status === 'NEVER' ? 'Sem registro' : 'A validar' }));
  const recent = [...data.panorama].filter((row) => row.daysSinceAccess != null).sort((a, b) => a.daysSinceAccess! - b.daysSinceAccess! || a.teacher.name.localeCompare(b.teacher.name, 'pt-BR')).slice(0, 10);
  return <div className="monitoring-view">
    <MonitoringMetrics label="Situação dos acessos ao ambiente" disabled={disabled} metrics={[
      { label: 'Docentes monitorados', value: s.total, detail: filters.accessScope === 'semester' ? 'Docentes das disciplinas do semestre' : 'Com disciplinas ativas no recorte', tone: 'blue', icon: Users, selected: filters.accessStatus === 'ALL', onClick: () => choose('ALL') },
      { label: 'Em dia (0–7 dias)', value: s.current, total: s.total, detail: 'Até sete dias desde o último acesso ao ambiente', tone: 'green', icon: CheckCircle2, selected: filters.accessStatus === 'CURRENT', onClick: () => choose('CURRENT') },
      { label: 'Atenção (8–14 dias)', value: s.attention, total: s.total, detail: 'Entre oito e quatorze dias sem acessar', tone: 'amber', icon: Clock3, selected: filters.accessStatus === 'ATTENTION', onClick: () => choose('ATTENTION') },
      { label: 'Crítico (15+ dias)', value: s.critical, total: s.total, detail: 'Quinze dias ou mais sem acessar', tone: 'rose', icon: TriangleAlert, selected: filters.accessStatus === 'CRITICAL', onClick: () => choose('CRITICAL') },
    ]} />
    <div className="monitoring-charts">
      <DistributionChart title="Distribuição por situação" unit="docentes" disabled={disabled} onSelect={(id) => choose(id as EnvironmentStatus)} slices={[
        { id: 'CURRENT', label: 'Em dia (0–7 dias)', value: s.current, tone: 'green' },
        { id: 'ATTENTION', label: 'Atenção (8–14 dias)', value: s.attention, tone: 'amber' },
        { id: 'CRITICAL', label: 'Crítico (15+ dias)', value: s.critical, tone: 'rose' },
        ...(s.never ? [{ id: 'NEVER', label: 'Sem acesso registrado', value: s.never, tone: 'purple' as const }] : []),
        { id: 'NOT_VERIFIABLE', label: 'A validar', value: s.validation, tone: 'slate' },
      ]} />
      <MonitoringChart title="Dias sem acesso por docente" description="Top 10 · maior intervalo primeiro" unit="Dias sem acesso ao ambiente" disabled={disabled} onSelect={onTeacher} empty="Nenhum docente com disciplina ativa neste recorte." footnote="Último acesso ao Moodle, com um registro por docente. Clique em um nome para filtrar." bars={bars} />
    </div>
    <div className="monitoring-lower-grid">
      <section className="occurrence-list" aria-labelledby="access-list-title">
        <header className="list-heading"><div><h2 id="access-list-title">Panorama por docente</h2></div><div className="list-controls"><label><span className="sr-only">Situação do acesso</span><select value={filters.accessStatus} disabled={disabled} onChange={(event) => choose(event.target.value as MonitoringFilters['accessStatus'])}><option value="ISSUES">Problemas e dados a validar</option><option value="ALERTS">Atenção, crítico e sem registro</option><option value="ALL">Todos os acessos</option><option value="CRITICAL">Críticos · 15+ dias</option><option value="ATTENTION">Atenção · 8–14 dias</option><option value="CURRENT">Em dia · 0–7 dias</option><option value="NEVER">Sem acesso registrado</option><option value="NOT_VERIFIABLE">A validar</option></select></label><button className="text-action" type="button" disabled={disabled} onClick={() => choose(filters.accessStatus === 'ALL' ? 'ISSUES' : 'ALL')}>{filters.accessStatus === 'ALL' ? 'Ver problemas' : 'Ver todos'}</button></div></header>
        {data.rows.length ? <div className="monitoring-table-wrap" tabIndex={0} role="region" aria-label="Lista de acessos; role para consultar todas as colunas"><table className="monitoring-table"><thead><tr><th>Docente</th><th>Disciplinas no recorte</th><th>Último acesso</th><th>Situação</th><th className="numeric">Dias sem acesso</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{data.rows.map((row) => <tr key={row.teacher.id}>
          <td><button className="teacher-link" type="button" disabled={disabled} onClick={() => onTeacher(row.teacher.id)}>{row.teacher.name}</button></td>
          <td title={row.courses.map((course) => course.name).join('; ')}>{row.courses[0]?.name}{row.courses.length > 1 && <small>+{row.courses.length - 1} disciplina(s)</small>}</td>
          <td className="date-cell">{formatDate(row.lastAccessAt, row.status === 'NEVER' ? 'Sem registro' : 'A validar')}</td>
          <td><span className={'state-label state-' + tones[row.status]}>{labels[row.status]}</span></td><td className="numeric"><strong>{row.daysSinceAccess ?? '—'}</strong></td><td><button className="text-action" type="button" disabled={disabled} onClick={() => onDeliveries(row.teacher.id)}>Entregas<ArrowRight size={14} /></button></td>
        </tr>)}</tbody></table></div> : <div className="empty-state"><strong>{s.total ? 'Nenhum registro nesta seleção' : 'Nenhum docente com disciplina ativa neste recorte'}</strong><span>{s.total && s.current === s.total ? 'Todos os docentes deste recorte estão em dia.' : 'Confira os filtros e a situação selecionada.'}</span></div>}
        <MonitoringPagination value={data.pagination} disabled={disabled} onChange={(page) => onChange({ ...filters, page })} />
      </section>
      <aside className="ned-panel priority-panel" aria-labelledby="priority-title"><header className="ned-panel-heading"><h2 id="priority-title"><TriangleAlert size={19} />Problemas prioritários</h2><button className="text-action" type="button" disabled={disabled} onClick={() => choose('ISSUES')}>Ver todos<ArrowRight size={14} /></button></header>
        {data.priorities.length ? <div className="priority-items">{data.priorities.map((row) => <button key={row.teacher.id} type="button" disabled={disabled} className={'priority-item priority-' + tones[row.status]} onClick={() => onTeacher(row.teacher.id)}>
          <span><strong>{row.teacher.name}</strong><small>{row.courses.length === 1 ? row.courses[0].name : row.courses.length + ' disciplinas no recorte'}</small></span><span><strong>{row.daysSinceAccess == null ? labels[row.status] : row.daysSinceAccess + ' dias'}</strong><small>{row.status === 'CRITICAL' ? 'Sem acesso recente' : labels[row.status]}</small></span>
        </button>)}</div> : <div className="ned-chart-empty">{s.total ? <CheckCircle2 size={30} /> : <Users size={30} className="empty-scope-icon" />}<strong>{s.total ? 'Nenhum problema de acesso' : 'Nenhum docente neste recorte'}</strong><span>{s.total ? 'Os docentes verificados estão em dia.' : 'Confira os filtros do acompanhamento.'}</span></div>}
        {(s.never > 0 || s.validation > 0) && <p className="ned-panel-note">Sem registro e dados a validar exigem conferência; não recebem zero dias.</p>}
      </aside>
    </div>
    <details className="ned-comparisons"><summary>Ver comparações · acessos mais recentes</summary><MonitoringChart title="Top 10 · acessos mais recentes" description="Menor intervalo desde o último acesso ao ambiente" unit="Dias sem acesso ao ambiente" bars={recent.map((row) => ({ id: row.teacher.id, label: row.teacher.name, value: row.daysSinceAccess, valueLabel: row.daysSinceAccess + 'd', detail: labels[row.status], tone: chartTones[row.status] }))} disabled={disabled} onSelect={onTeacher} empty="Nenhuma data de acesso confirmada." footnote="Recência do último acesso; a frequência de utilização não é medida por este indicador." /></details>
  </div>;
}
