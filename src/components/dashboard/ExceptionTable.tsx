import { ChevronLeft, ChevronRight, ListFilter, SearchX } from "lucide-react";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import type { AssignmentRow, DashboardData, DashboardFilters } from "@/types/dashboard";

function structureStatus(row: AssignmentRow) {
  return row.requirements.find((item) => item.status === "PENDING" && item.overdue)?.status
    || row.requirements.find((item) => item.status === "PENDING")?.status
    || row.requirements.find((item) => item.status === "NOT_VERIFIABLE")?.status
    || row.requirements.find((item) => item.status === "DELIVERED_LATE")?.status
    || row.requirements.find((item) => item.status === "INHERITED_READY")?.status
    || row.requirements.find((item) => item.status === "NOT_APPLICABLE")?.status
    || "DELIVERED_ON_TIME";
}

interface Props { data: DashboardData; filters: DashboardFilters; onFilters: (next: DashboardFilters) => void; onOpen: (row: AssignmentRow) => void }
export function ExceptionTable({ data, filters, onFilters, onOpen }: Props) {
  return <section className="data-section">
    <div className="section-heading"><div><span className="eyebrow"><ListFilter size={14} />Acompanhamento detalhado</span><h2>Docentes e disciplinas</h2><p>Estrutura e acesso avaliados separadamente.</p></div><strong className="result-count">{data.pagination.total} resultado{data.pagination.total === 1 ? "" : "s"}</strong></div>
    {data.rows.length === 0 ? <div className="empty-state"><SearchX size={30} /><strong>Nenhum resultado</strong><span>Altere ou limpe os filtros.</span></div> : <>
      <div className="table-wrap"><table><thead><tr><th>Disciplina</th><th>Docente</th><th>Estrutura</th><th>Acesso</th><th>Ponto principal</th><th><span className="sr-only">Ação</span></th></tr></thead><tbody>{data.rows.map((row) => <tr key={row.id} className={`row-${row.severity.toLowerCase()}`}><td data-label="Disciplina"><strong>{row.course.shortName}</strong><small>{row.course.modalityLabel} · {row.course.workloadHours}h</small></td><td data-label="Docente"><strong>{row.teacher.name}</strong><small>{row.issueCount} pendência{row.issueCount === 1 ? "" : "s"}{row.dataQualityCount ? ` · ${row.dataQualityCount} dado${row.dataQualityCount === 1 ? "" : "s"} a validar` : ""}</small></td><td data-label="Estrutura"><StatusBadge status={structureStatus(row)} /></td><td data-label="Acesso"><StatusBadge status={row.accessStatus} /><small>{row.lastAccessAt ? `${row.daysSinceAccess} dia${row.daysSinceAccess === 1 ? "" : "s"}` : "Sem registro"}</small></td><td data-label="Ponto principal" className="reason-cell">{row.primaryReason}</td><td><button className="link-button" type="button" onClick={() => onOpen(row)} aria-label={`Ver evidências de ${row.teacher.name}`}>Ver evidências</button></td></tr>)}</tbody></table></div>
      {data.pagination.pages > 1 && <nav className="pagination" aria-label="Paginação"><button type="button" disabled={filters.page <= 1} onClick={() => onFilters({ ...filters, page: filters.page - 1 })}><ChevronLeft size={16} />Anterior</button><span>Página {data.pagination.page} de {data.pagination.pages}</span><button type="button" disabled={filters.page >= data.pagination.pages} onClick={() => onFilters({ ...filters, page: filters.page + 1 })}>Próxima<ChevronRight size={16} /></button></nav>}
    </>}
  </section>;
}
