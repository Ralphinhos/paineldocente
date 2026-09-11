import { RotateCcw, Search } from "lucide-react";
import type { DashboardData, DashboardFilters as FilterState } from "@/types/dashboard";

interface Props { value: FilterState; options: DashboardData["filters"]; onChange: (next: FilterState) => void }
export function DashboardFilters({ value, options, onChange }: Props) {
  const patch = (key: keyof FilterState, next: string | number) => onChange({ ...value, [key]: next, page: key === "page" ? Number(next) : 1 });
  const dirty = Boolean(value.period || value.modality || value.courseId || value.status || value.query || value.teacherId);
  return <section className="filter-panel" aria-label="Filtros">
    <label className="search-field"><Search size={17} aria-hidden="true" /><span className="sr-only">Buscar</span><input value={value.query} onChange={(event) => patch("query", event.target.value)} placeholder="Buscar docente ou disciplina" /></label>
    <label><span>Período</span><select value={value.period} onChange={(event) => patch("period", event.target.value)}><option value="">Todos</option>{options.periods.map((item) => <option key={item}>{item}</option>)}</select></label>
    <label><span>Modalidade</span><select value={value.modality} onChange={(event) => patch("modality", event.target.value)}><option value="">Todas</option>{options.modalities.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
    <label><span>Disciplina</span><select value={value.courseId} onChange={(event) => patch("courseId", event.target.value)}><option value="">Todas</option>{options.courses.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
    <label><span>Situação da lista</span><select value={value.status} onChange={(event) => patch("status", event.target.value)}><option value="">Todas</option><option value="CRITICAL,NEVER">Acesso crítico</option><option value="OVERDUE">Entregas vencidas</option><option value="PENDING">A entregar</option><option value="DELIVERED_LATE">Entregue com atraso</option><option value="NOT_VERIFIABLE">A validar</option><option value="NOT_APPLICABLE">Não aplicável</option><option value="INHERITED_READY">Estrutura herdada</option><option value="CURRENT">Acesso em dia</option></select></label>
    <button className="clear-button" type="button" disabled={!dirty} onClick={() => onChange({ period: "", modality: "", courseId: "", status: "", query: "", page: 1 })}><RotateCcw size={16} />Limpar</button>
  </section>;
}
