import { CheckCircle2, ClipboardList, Clock3, FileSearch, Info, SquarePen, TriangleAlert, X } from 'lucide-react';
import { DistributionChart } from './DistributionChart';
import { MonitoringChart } from './MonitoringChart';
import { MonitoringMetrics } from './MonitoringMetrics';
import { MonitoringPagination } from './MonitoringPagination';
import { TeacherDeliveryChart } from './TeacherDeliveryChart';
import { deliveryPresentation, formatDate } from '@/lib/presentation';
import { bimestreLabel } from '@/lib/dashboardView';
import { formatPercent } from '@/lib/monitoringCharts';
import type { DeliveryRecord, MonitoringData, MonitoringFilters } from '@/types/monitoring';

interface Props { data: MonitoringData['deliveries']; filters: MonitoringFilters; disabled: boolean; onChange: (filters: MonitoringFilters) => void; onTeacher: (id: string) => void; onOpen: (row: DeliveryRecord) => void; onManual: (row?: DeliveryRecord) => void }
export function DeliveryOverview({ data, filters, disabled, onChange, onTeacher, onOpen, onManual }: Props) {
  const { summary: s } = data;
  const choose = (deliveryStatus: MonitoringFilters['deliveryStatus']) => onChange({ ...filters, deliveryStatus, page: 1 });
  const regular = s.early + s.onTime + s.inherited;
  const activity = data.activityChart.find((row) => row.id === filters.activityKey);
  const best = [...data.teacherOverview].filter((row) => row.onTimePercent != null && row.counts.validation === 0).sort((a, b) => b.onTimePercent! - a.onTimePercent! || b.due - a.due || a.teacher.name.localeCompare(b.teacher.name, 'pt-BR')).slice(0, 10);
  return <div className="monitoring-view">
    <MonitoringMetrics label="Situação das entregas e prazos" disabled={disabled} metrics={[
      { label: 'Atividades analisadas', value: s.total, detail: 'Atividades aplicáveis no recorte', tone: 'blue', icon: ClipboardList, selected: filters.deliveryStatus === 'ALL', onClick: () => choose('ALL') },
      { label: 'Entregues no prazo', value: regular, total: s.total, detail: 'Antecipadas, no prazo e replicadas conferidas', tone: 'green', icon: CheckCircle2, selected: filters.deliveryStatus === 'COMPLIANT', onClick: () => choose('COMPLIANT') },
      { label: 'Pendentes dentro do prazo', value: s.pendingInTime, total: s.total, detail: 'Pendentes com prazo em aberto', tone: 'amber', icon: Clock3, selected: filters.deliveryStatus === 'PENDING', onClick: () => choose('PENDING') },
      { label: 'Pendências vencidas', value: s.overdue, total: s.total, detail: 'Atraso contando até a entrega', tone: 'rose', icon: TriangleAlert, selected: filters.deliveryStatus === 'OVERDUE', onClick: () => choose('OVERDUE') },
    ]} />
    <div className="monitoring-charts">
      <DistributionChart title="Distribuição geral das entregas" unit="atividades" disabled={disabled} onSelect={(id) => choose(id as MonitoringFilters['deliveryStatus'])} note={s.notApplicable ? s.notApplicable + ' item(ns) não aplicável(is) fora dos totais.' : undefined} slices={[
        { id: 'EARLY', label: 'Antecipadas', value: s.early, tone: 'blue' },
        { id: 'ON_TIME_OR_INHERITED', label: 'No prazo e replicadas', value: s.onTime + s.inherited, tone: 'green' },
        { id: 'DELIVERED_LATE', label: 'Entregues com atraso', value: s.deliveredLate, tone: 'orange' },
        { id: 'PENDING', label: 'Pendentes dentro do prazo', value: s.pendingInTime, tone: 'yellow' },
        { id: 'OVERDUE', label: 'Pendências vencidas', value: s.overdue, tone: 'rose' },
        { id: 'NOT_VERIFIABLE', label: 'A validar', value: s.validation, tone: 'slate' },
      ]} />
      <TeacherDeliveryChart rows={data.teacherOverview} disabled={disabled} onTeacher={onTeacher} />
    </div>
    <div className="monitoring-lower-grid">
      <section className="occurrence-list" aria-labelledby="delivery-list-title">
        <header className="list-heading"><h2 id="delivery-list-title">{filters.deliveryStatus === 'OVERDUE' ? 'Pendências críticas' : 'Atividades do recorte'}</h2><div className="list-controls"><button className="text-action" type="button" disabled={disabled} onClick={() => onManual()}><SquarePen size={16} />Registrar UA e videoaulas</button><label><span className="sr-only">Situação da entrega</span><select value={filters.deliveryStatus} disabled={disabled} onChange={(event) => choose(event.target.value as MonitoringFilters['deliveryStatus'])}><option value="OVERDUE">Pendências vencidas</option><option value="ALL">Todas as entregas</option><option value="COMPLIANT">Antecipadas, no prazo e replicadas</option><option value="PENDING">Pendentes dentro do prazo</option><option value="EARLY">Entregues antecipadamente</option><option value="ON_TIME_OR_INHERITED">No prazo e replicadas</option><option value="ON_TIME">Entregues no prazo</option><option value="DELIVERED_LATE">Entregues com atraso · resolvidas</option><option value="INHERITED_READY">Replicadas no prazo</option><option value="NOT_VERIFIABLE">A validar</option><option value="NOT_APPLICABLE">Não aplicáveis</option></select></label><button className="text-action" type="button" disabled={disabled} onClick={() => choose(filters.deliveryStatus === 'ALL' ? 'OVERDUE' : 'ALL')}>{filters.deliveryStatus === 'ALL' ? 'Ver problemas' : 'Ver todas'}</button></div></header>
        {filters.activityKey && <div className="activity-selection"><span>Atividade: {activity ? activity.label + ' · ' + activity.modality : filters.activityKey}</span><button type="button" disabled={disabled} onClick={() => onChange({ ...filters, activityKey: '', page: 1 })}>Limpar<X size={14} /></button></div>}
        {data.rows.length ? <div className="monitoring-table-wrap" tabIndex={0} role="region" aria-label="Lista de entregas; role para consultar todas as colunas"><table className="monitoring-table delivery-monitoring-table"><thead><tr><th>Docente e disciplina</th><th>Item</th><th>Bimestre</th><th>Prazo</th><th>Situação</th><th>Atraso</th><th>Origem</th><th><span className="sr-only">Conferir evidências</span></th></tr></thead><tbody>{data.rows.map((row) => {
          const presentation = deliveryPresentation(row.item);
          return <tr key={row.id}>
            <td>{row.item.responsibility === 'UNCONFIRMED' ? <strong>Responsável a definir</strong> : <button className="teacher-link" type="button" disabled={disabled} onClick={() => onTeacher(row.teacher.id)}>{row.teacher.name}</button>}<small>{row.course.name}</small></td>
            <td><strong>{row.item.label}</strong></td><td>{bimestreLabel(row.item)}</td><td className="date-cell">{formatDate(row.item.deadlineAt, 'A validar')}</td>
            <td><span className={'delivery-label delivery-' + presentation.tone}>{presentation.label}</span></td><td className={'ned-delay delay-' + presentation.tone}>{['PENDING', 'DELIVERED_LATE'].includes(row.item.status) ? presentation.detail : '—'}</td>
            <td>{row.item.manualControl ? 'Manual' : 'Moodle'}</td><td><button className="icon-button" type="button" disabled={disabled} aria-label={'Conferir ' + row.item.label + ' de ' + row.teacher.name} onClick={() => onOpen(row)}><FileSearch size={16} /></button>{row.item.manualControl && <button className="text-action" type="button" disabled={disabled} onClick={() => onManual(row)}>Registrar</button>}</td>
          </tr>;
        })}</tbody></table></div> : <div className="empty-state"><strong>{filters.deliveryStatus === 'OVERDUE' ? 'Nenhuma pendência vencida confirmada' : 'Nenhuma atividade nesta seleção'}</strong><span>{s.validation ? s.validation + ' item(ns) ainda precisam de validação.' : s.total ? 'Confira os demais itens em “Ver todas”.' : 'Confira os filtros do relatório.'}</span></div>}
        <MonitoringPagination value={data.pagination} disabled={disabled} onChange={(page) => onChange({ ...filters, page })} />
      </section>
      <aside className="delivery-side-panels">
        <MonitoringChart title="Atividades com mais pendências" description="Top 10 · por atividade e modalidade" unit="Pendências vencidas" compact disabled={disabled} onSelect={(id) => onChange({ ...filters, activityKey: id, deliveryStatus: 'OVERDUE', page: 1 })} empty="Nenhuma atividade com pendência vencida." footnote="Rótulo: pendências / itens já exigíveis. Clique para conferir a atividade." bars={data.activityChart.map((row) => ({ id: row.id, label: row.label + ' · ' + row.modality, value: row.overdue, valueLabel: row.overdue + '/' + row.due, detail: 'Maior atraso: ' + row.maxDaysLate + ' dias', tone: 'rose' }))} />
        <section className="ned-panel reading-rules"><header className="ned-panel-heading"><h2>Regras da leitura</h2></header><ul><li><CheckCircle2 />Materiais replicados e conferidos = no prazo</li><li><ClipboardList />Bimestres permanecem separados</li><li><TriangleAlert />Avaliação substitutiva fora do critério</li><li><Info />Dados incertos = a validar</li></ul></section>
      </aside>
    </div>
    <details className="ned-comparisons"><summary>Ver comparações · entregas no prazo</summary><MonitoringChart title="Top 10 · entregas no prazo" description="Percentual entre itens já exigíveis com dados confirmados" unit="Percentual no prazo" disabled={disabled} onSelect={(id) => onChange({ ...filters, teacherId: id, deliveryStatus: 'COMPLIANT', activityKey: '', page: 1 })} empty="Nenhuma base confirmada para comparar neste recorte." footnote="Relação com a base exigível, sem compensar atrasos com entregas futuras. Docentes com itens a validar ficam fora desta comparação." bars={best.map((row) => ({ id: row.teacher.id, label: row.teacher.name, value: row.onTimePercent, valueLabel: formatPercent(row.onTimePercent), detail: row.onTimeDue + ' de ' + row.due + ' itens já exigíveis no prazo', tone: 'green' }))} /></details>
  </div>;
}
