import { CheckCircle2, ClipboardList, Clock3, FileSearch, SquarePen, TriangleAlert } from 'lucide-react';
import { DelayLabel } from './DelayLabel';
import { MonitoringChart } from './MonitoringChart';
import { MonitoringMetrics } from './MonitoringMetrics';
import { MonitoringPagination } from './MonitoringPagination';
import { formatDate } from '@/lib/presentation';
import type { DeliveryRecord, MonitoringData, MonitoringFilters } from '@/types/monitoring';

interface Props { data: MonitoringData['deliveries']; filters: MonitoringFilters; disabled: boolean; onChange: (filters: MonitoringFilters) => void; onTeacher: (id: string) => void; onOpen: (row: DeliveryRecord) => void; onManual: (row?: DeliveryRecord) => void }
export function DeliveryOverview({ data, filters, disabled, onChange, onTeacher, onOpen, onManual }: Props) {
  const { summary: s } = data;
  const choose = (deliveryStatus: MonitoringFilters['deliveryStatus']) => onChange({ ...filters, deliveryStatus, page: 1 });
  return <div className="monitoring-view">
    <MonitoringMetrics label="Situação das entregas e prazos" disabled={disabled} metrics={[
      { label: 'Itens acompanhados', value: s.total, detail: 'Atividades aplicáveis no recorte', tone: 'blue', icon: ClipboardList, selected: filters.deliveryStatus === 'ALL', onClick: () => choose('ALL') },
      { label: 'Entregas no prazo', value: s.early + s.onTime + s.inherited, total: s.total, detail: 'Antecipadas, no prazo e replicadas', tone: 'green', icon: CheckCircle2, selected: filters.deliveryStatus === 'COMPLIANT', onClick: () => choose('COMPLIANT') },
      { label: 'Pendências vencidas', value: s.overdue, total: s.total, detail: 'Atraso contando até a entrega', tone: 'rose', icon: TriangleAlert, selected: filters.deliveryStatus === 'OVERDUE', onClick: () => choose('OVERDUE') },
      { label: 'Dentro do prazo', value: s.pendingInTime, total: s.total, detail: 'Pendentes com prazo em aberto', tone: 'amber', icon: Clock3, selected: filters.deliveryStatus === 'PENDING', onClick: () => choose('PENDING') },
    ]} />
    <div className="monitoring-subactions"><div className="validation-line"><button type="button" disabled={disabled} onClick={() => choose('DELIVERED_LATE')}>{s.deliveredLate} entrega(s) com atraso já resolvida(s)</button>{s.validation > 0 && <button className="needs-validation" type="button" disabled={disabled} onClick={() => choose('NOT_VERIFIABLE')}>{s.validation} item(ns) a validar</button>}</div><button className="secondary-button" type="button" disabled={disabled} onClick={() => onManual()}><SquarePen size={17} />Registrar UA e videoaulas</button></div>
    <div className="monitoring-charts">
      <MonitoringChart title="Pendências vencidas por docente" description="Até 10 docentes · maior atraso primeiro" unit="itens vencidos" disabled={disabled} onSelect={onTeacher} empty="Nenhuma pendência vencida confirmada neste recorte." footnote="A barra conta itens ainda pendentes. Abaixo do nome, o maior atraso em dias." bars={data.chart.map((row) => ({ id: row.teacher.id, label: row.teacher.name, value: row.overdue, detail: 'Maior atraso: ' + row.maxDaysLate + ' dias', tone: 'rose' }))} />
      <MonitoringChart title="Situação das entregas" description="Quantidade de atividades por situação · clique para conferir" unit="atividades" disabled={disabled} onSelect={(id) => choose(id as MonitoringFilters['deliveryStatus'])} empty="Nenhuma atividade aplicável neste recorte." footnote={'Antecipadas e replicadas conferidas entram em “No prazo”. ' + s.notApplicable + ' item(ns) não aplicável(is) fora dos totais.'} bars={s.total ? [
        { id: 'COMPLIANT', label: 'No prazo', value: s.early + s.onTime + s.inherited, detail: 'Entregas regulares', tone: 'green' },
        { id: 'OVERDUE', label: 'Vencidas', value: s.overdue, detail: 'Ainda pendentes', tone: 'rose' },
        { id: 'PENDING', label: 'Dentro do prazo', value: s.pendingInTime, detail: 'Aguardando entrega', tone: 'amber' },
        { id: 'DELIVERED_LATE', label: 'Resolvidas', value: s.deliveredLate, detail: 'Entregues com atraso', tone: 'blue' },
        { id: 'NOT_VERIFIABLE', label: 'A validar', value: s.validation, detail: 'Dados a conferir', tone: 'slate' },
      ] : []} />
    </div>
    <section className="occurrence-list" aria-labelledby="delivery-list-title">
      <header className="list-heading"><div><h2 id="delivery-list-title">Atividades para conferir</h2><p>Prazo e evidência determinam a entrega</p></div><div className="list-controls"><label><span className="sr-only">Situação da entrega</span><select value={filters.deliveryStatus} disabled={disabled} onChange={(event) => choose(event.target.value as MonitoringFilters['deliveryStatus'])}><option value="OVERDUE">Pendências vencidas</option><option value="ALL">Todas as entregas</option><option value="COMPLIANT">Antecipadas, no prazo e replicadas</option><option value="PENDING">Pendentes dentro do prazo</option><option value="EARLY">Entregues antecipadamente</option><option value="ON_TIME">Entregues no prazo</option><option value="DELIVERED_LATE">Entregues com atraso · resolvidas</option><option value="INHERITED_READY">Replicadas no prazo</option><option value="NOT_VERIFIABLE">A validar</option><option value="NOT_APPLICABLE">Não aplicáveis</option></select></label><button className="text-action" type="button" disabled={disabled} onClick={() => choose(filters.deliveryStatus === 'ALL' ? 'OVERDUE' : 'ALL')}>{filters.deliveryStatus === 'ALL' ? 'Ver problemas' : 'Ver todas'}</button></div></header>
      {data.rows.length ? <div className="monitoring-table-wrap" tabIndex={0} role="region" aria-label="Lista de entregas; role para consultar todas as colunas"><table className="monitoring-table delivery-monitoring-table"><thead><tr><th>Docente e disciplina</th><th>Atividade</th><th>Prazo</th><th>Entrega</th><th>Situação e atraso</th><th><span className="sr-only">Conferir evidências</span></th></tr></thead><tbody>{data.rows.map((row) => <tr key={row.id}>
        <td>{row.item.responsibility === 'UNCONFIRMED' ? <strong>Responsável a definir</strong> : <button className="teacher-link" type="button" disabled={disabled} onClick={() => onTeacher(row.teacher.id)}>{row.teacher.name}</button>}<small>{row.course.name}</small><small className="course-code">{row.course.shortName}</small></td>
        <td><strong>{row.item.label}</strong><small>{row.item.manualControl ? 'Registro manual do NED' : 'Coleta automática do Moodle'}</small></td>
        <td className="date-cell">{formatDate(row.item.deadlineAt, 'A validar')}</td><td className="date-cell">{formatDate(row.item.manualEvidenceDate || row.item.configuredAt)}{row.item.timingSource === 'SNAPSHOT_OBSERVED' && <small>Observada na coleta</small>}</td>
        <td><DelayLabel item={row.item} /></td><td><button className="icon-button" type="button" disabled={disabled} aria-label={'Conferir ' + row.item.label + ' de ' + row.teacher.name} onClick={() => onOpen(row)}><FileSearch size={18} /></button>{row.item.manualControl && <button className="text-action" type="button" disabled={disabled} onClick={() => onManual(row)}>Registrar</button>}</td>
      </tr>)}</tbody></table></div> : <div className="empty-state"><strong>{filters.deliveryStatus === 'OVERDUE' ? 'Nenhuma pendência vencida confirmada' : 'Nenhuma atividade nesta seleção'}</strong><span>{s.validation ? s.validation + ' item(ns) ainda precisam de validação.' : s.total ? 'Os demais itens verificados seguem disponíveis em “Ver todas”.' : 'Confira os filtros do relatório.'}</span></div>}
      <MonitoringPagination value={data.pagination} disabled={disabled} onChange={(page) => onChange({ ...filters, page })} />
    </section>
  </div>;
}
