import { Fragment, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, SearchX } from 'lucide-react';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { deliveryPresentation, formatDate } from '@/lib/presentation';
import type { AssignmentRow, DashboardData, DashboardFilters } from '@/types/dashboard';

function deliverySummary(row: AssignmentRow) {
  const items = row.requirements.filter((item) => item.responsibility !== 'OTHER_TEACHER');
  const overdue = items.filter((item) => item.status === 'PENDING' && item.overdue).length;
  const uncertain = items.filter((item) => item.status === 'NOT_VERIFIABLE' || item.responsibility === 'UNCONFIRMED').length;
  const pending = items.filter((item) => item.status === 'PENDING' && !item.overdue).length;
  const late = items.filter((item) => item.status === 'DELIVERED_LATE').length;
  if (overdue) return { label: overdue + ' pendente' + (overdue === 1 ? '' : 's') + ' em atraso', tone: 'danger', detail: uncertain ? uncertain + ' a validar' : '' };
  if (uncertain) return { label: uncertain + ' a validar', tone: 'info', detail: 'Confira as evidências' };
  if (pending) return { label: pending + ' pendente' + (pending === 1 ? '' : 's') + ' no prazo', tone: 'info', detail: '' };
  if (late) return { label: late + ' entrega' + (late === 1 ? '' : 's') + ' com atraso', tone: 'warning', detail: '' };
  if (!items.length) return { label: 'Sem itens atribuídos', tone: 'muted', detail: '' };
  if (items.every((item) => item.status === 'NOT_APPLICABLE')) return { label: 'Não aplicável', tone: 'muted', detail: 'Dispensa justificada' };
  if (items.some((item) => item.status === 'INHERITED_READY')) return { label: 'Replicado no prazo', tone: 'success', detail: 'Material reaproveitado' };
  return { label: 'Entregue no prazo', tone: 'success', detail: '' };
}
function greatestDelay(row: AssignmentRow) {
  const late = row.requirements.filter((item) => item.responsibility !== 'OTHER_TEACHER' && (item.status === 'DELIVERED_LATE' || item.status === 'PENDING' && item.overdue));
  if (!late.length) return '—';
  if (late.some((item) => item.daysLate == null)) return 'A validar';
  const days = Math.max(...late.map((item) => item.daysLate ?? 0));
  return days + ' dia' + (days === 1 ? '' : 's');
}
interface Props { data: DashboardData; filters: DashboardFilters; onFilters: (next: DashboardFilters) => void; onOpen: (row: AssignmentRow) => void }

export function ExceptionTable({ data, filters, onFilters, onOpen }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  return <section className="data-section" aria-labelledby="tracking-title">
    <div className="section-heading"><div><h2 id="tracking-title">Entregas por disciplina</h2><p>Abra a linha para conferir cada atividade.</p></div><span className="result-count">{data.pagination.total} vínculo{data.pagination.total === 1 ? '' : 's'}</span></div>
    {data.rows.length === 0 ? <div className="empty-state"><SearchX size={28} aria-hidden="true" /><strong>Nenhum resultado</strong><span>Altere ou limpe os filtros.</span><button className="secondary-button" type="button" onClick={() => onFilters({ ...filters, query: '', status: '', requirementGroup: '', teacherId: '', page: 1 })}>Limpar busca e situação</button></div> : <>
      <div className="table-wrap" role="region" aria-label="Disciplinas e atividades; role para consultar todas as colunas" tabIndex={0}>
        <table className="tracking-table"><thead><tr><th>Disciplina</th><th>Docente</th><th>Entregas</th><th>Maior atraso</th><th>Último acesso</th><th><span className="sr-only">Consultar atividades</span></th></tr></thead>
          <tbody>{data.rows.map((row) => {
            const summary = deliverySummary(row);
            const open = expanded.has(row.id);
            return <Fragment key={row.id}>
              <tr className={open ? 'row-expanded' : ''}>
                <td className="discipline-cell"><strong>{row.course.name}</strong><small>{row.course.modalityLabel} · {row.course.workloadHours}h · {row.course.shortName}</small></td>
                <td className="teacher-cell"><strong>{row.teacher.name}</strong></td>
                <td><span className={'delivery-label delivery-' + summary.tone}>{summary.label}</span>{summary.detail && <small>{summary.detail}</small>}</td>
                <td className="numeric-cell">{greatestDelay(row)}</td>
                <td><StatusBadge status={row.accessStatus} /><small>{row.accessStatus === 'OUTSIDE_WINDOW' ? 'Período inativo' : row.daysSinceAccess == null ? 'Sem registro' : row.daysSinceAccess === 0 ? 'Hoje' : row.daysSinceAccess + ' dia' + (row.daysSinceAccess === 1 ? '' : 's') + ' sem acesso'}</small></td>
                <td><button className="text-action" type="button" aria-expanded={open} aria-controls={'items-' + row.id} onClick={() => toggle(row.id)} aria-label={(open ? 'Fechar atividades de ' : 'Ver atividades de ') + row.course.name}>{open ? 'Fechar' : 'Atividades'}<ChevronDown size={16} className={open ? 'rotated' : ''} aria-hidden="true" /></button></td>
              </tr>
              {open && <tr className="activity-detail-row"><td colSpan={6}><section id={'items-' + row.id} className="activity-sheet" aria-label={'Atividades de ' + row.course.name}>
                <table className="activity-table"><caption className="sr-only">Prazo, entrega e atraso de cada atividade</caption><thead><tr><th>Atividade</th><th>Prazo</th><th>Envio / gravação / preparo</th><th>Situação</th><th>Atraso</th></tr></thead><tbody>
                  {row.requirements.filter((item) => item.responsibility !== 'OTHER_TEACHER').map((item) => {
                    const display = deliveryPresentation(item);
                    const date = item.manualControl ? item.manualEvidenceDate : item.configuredAt;
                    return <tr key={item.id}>
                      <td><strong>{item.label}</strong>{item.manualVersion != null && item.manualVersion > 1 && <small>Versão {item.manualVersion}</small>}{item.responsibility === 'UNCONFIRMED' && <small>Responsável a definir</small>}</td>
                      <td>{formatDate(item.deadlineAt, 'A validar')}</td>
                      <td>{formatDate(date)}{item.timingSource === 'SNAPSHOT_OBSERVED' && <small>Observado na coleta</small>}</td>
                      <td><span className={'delivery-label delivery-' + display.tone}>{display.label}</span></td>
                      <td className="numeric-cell">{display.detail}</td>
                    </tr>;
                  })}
                </tbody></table>
                <div className="activity-sheet-footer"><span>Datas e atrasos referentes à coleta deste relatório.</span><button className="text-action" type="button" onClick={() => onOpen(row)}>Ver evidências</button></div>
              </section></td></tr>}
            </Fragment>;
          })}</tbody>
        </table>
      </div>
      <nav className="pagination" aria-label="Paginação"><span>{data.pagination.total} vínculos · página {data.pagination.page} de {data.pagination.pages}</span><div><button type="button" disabled={filters.page <= 1} onClick={() => onFilters({ ...filters, page: filters.page - 1 })}><ChevronLeft size={16} />Anterior</button><button type="button" disabled={filters.page >= data.pagination.pages} onClick={() => onFilters({ ...filters, page: filters.page + 1 })}>Próxima<ChevronRight size={16} /></button></div></nav>
    </>}
  </section>;
}
