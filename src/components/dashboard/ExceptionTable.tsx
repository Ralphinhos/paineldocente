import { ChevronLeft, ChevronRight, SearchX, ScanSearch, Pencil } from 'lucide-react';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { deliveryPresentation, formatDate } from '@/lib/presentation';
import { activityRows, bimestreLabel } from '@/lib/dashboardView';
import type { AssignmentRow, DashboardData, DashboardFilters, Requirement } from '@/types/dashboard';

function delay(item: Requirement) {
  if (item.responsibility === 'UNCONFIRMED' || ['NOT_VERIFIABLE', 'NOT_APPLICABLE'].includes(item.status)) return '—';
  if (item.status === 'INHERITED_READY') return '0';
  if (item.daysLate != null) return String(item.daysLate);
  return item.delayPrecision === 'OBSERVED' && item.observedLateDays != null ? 'Até ' + item.observedLateDays + '*' : 'A validar';
}
interface Props { data: DashboardData; filters: DashboardFilters; onFilters: (next: DashboardFilters) => void; onOpen: (row: AssignmentRow) => void }

export function ExceptionTable({ data, filters, onFilters, onOpen }: Props) {
  const lines = activityRows(data.rows, filters);
  const bimestral = lines.some(({ item }) => bimestreLabel(item) !== '—');
  return <section className="data-section activity-register" aria-labelledby="tracking-title">
    <div className="section-heading"><div><h2 id="tracking-title">Organização e preenchimento da disciplina</h2><p>Uma linha por atividade · mesmo formato da planilha</p></div><span className="result-count">{lines.length} linhas nesta página</span></div>
    {!lines.length ? <div className="empty-state"><SearchX size={28} aria-hidden="true" /><strong>Nenhuma atividade nesta seleção</strong><span>Altere a situação ou limpe os filtros.</span><button className="secondary-button" type="button" onClick={() => onFilters({ ...filters, query: '', status: '', requirementGroup: '', requirementId: '', teacherId: '', page: 1 })}>Limpar seleção</button></div> : <>
      <div className="table-wrap activity-register-wrap" role="region" aria-label="Planilha de atividades; role para consultar todas as colunas" tabIndex={0}>
        <table className="tracking-table"><caption className="sr-only">Prazo, entrega, atraso e acesso de cada atividade atribuída ao docente</caption><thead><tr><th scope="col" className="frozen-cell">Disciplina</th><th scope="col">Modalidade</th><th scope="col">Docente</th><th scope="col">C.H.</th>{bimestral && <th scope="col">Bim.</th>}<th scope="col">Atividade</th><th scope="col">Data limite</th><th scope="col">Envio / gravação / preparo</th><th scope="col">Atraso (dias)</th><th scope="col">Situação da entrega</th><th scope="col">Acesso (dias)</th><th scope="col"><span className="sr-only">Ver evidências</span></th></tr></thead>
          <tbody>{lines.map(({ id, row, item }) => {
            const display = deliveryPresentation(item);
            const date = item.manualControl ? item.manualEvidenceDate : item.configuredAt;
            const uncertain = item.responsibility === 'UNCONFIRMED';
            return <tr key={id}>
              <td className="discipline-cell frozen-cell"><strong>{row.course.name}</strong><small>{row.course.shortName} · {row.course.period}</small></td>
              <td>{row.course.modalityLabel}</td><td className="teacher-cell">{row.teacher.name}{uncertain && <small className="text-warning">Responsável a validar</small>}</td><td className="numeric-cell">{row.course.workloadHours}h</td>{bimestral && <td>{bimestreLabel(item)}</td>}
              <td className="item-cell"><strong>{item.label}</strong>{item.manualControl && <span className="manual-marker" title="Registro manual do NED"><Pencil size={12} /><span className="sr-only">Controle manual</span></span>}{item.manualVersion != null && item.manualVersion > 1 && <small>Versão {item.manualVersion}</small>}</td>
              <td className="date-cell">{formatDate(item.deadlineAt, 'A validar')}</td><td className="date-cell">{formatDate(date)}{item.timingSource === 'SNAPSHOT_OBSERVED' && <small>Data observada*</small>}</td>
              <td className={'numeric-cell delay-cell ' + (uncertain ? '' : item.status === 'PENDING' && item.overdue ? 'cell-overdue' : item.status === 'DELIVERED_LATE' ? 'cell-late' : '')}><strong>{delay(item)}</strong></td>
              <td className={'status-cell cell-' + (uncertain ? 'info' : display.tone)}><span className={'delivery-label delivery-' + (uncertain ? 'info' : display.tone)}>{uncertain ? 'Responsável a validar' : display.label}</span></td>
              <td className="access-cell"><strong>{row.accessStatus === 'OUTSIDE_WINDOW' || row.daysSinceAccess == null ? '—' : row.daysSinceAccess}</strong><StatusBadge status={row.accessStatus} /></td>
              <td><button className="icon-button" type="button" onClick={() => onOpen({ ...row, requirements: [item] })} aria-label={'Ver evidências de ' + item.label + ', ' + row.teacher.name + ', ' + row.course.name} title="Ver evidências"><ScanSearch size={17} /></button></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      <div className="sheet-legend"><span><i className="legend-ontime" />No prazo / replicado</span><span><i className="legend-late" />Entregue com atraso</span><span><i className="legend-overdue" />Pendente em atraso</span><span>* Data observada exige validação</span></div>
      <nav className="pagination" aria-label="Páginas da planilha"><span>{data.pagination.total} vínculos docente–disciplina · página {data.pagination.page} de {data.pagination.pages}</span><div><button type="button" disabled={data.pagination.page <= 1} onClick={() => onFilters({ ...filters, page: data.pagination.page - 1 })}><ChevronLeft size={16} />Anterior</button><button type="button" disabled={data.pagination.page >= data.pagination.pages} onClick={() => onFilters({ ...filters, page: data.pagination.page + 1 })}>Próxima<ChevronRight size={16} /></button></div></nav>
    </>}
  </section>;
}
