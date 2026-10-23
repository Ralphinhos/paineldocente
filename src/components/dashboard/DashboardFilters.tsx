import { ListFilter, RotateCcw, Search } from 'lucide-react';
import type { DashboardData, DashboardFilters as FilterState } from '@/types/dashboard';

export function DashboardFilters({ value, options, onChange, showStatus = false }: { value: FilterState; options: DashboardData['filters']; onChange: (next: FilterState) => void; showStatus?: boolean }) {
  const patch = (key: keyof FilterState, next: string) => onChange({ ...value, [key]: next, ...(key === 'status' ? { requirementGroup: '', requirementId: '' } : {}), page: 1 });
  const dirty = Boolean(value.period || value.modality || value.courseId || value.status || value.requirementGroup || value.requirementId || value.query || value.teacherId);
  return <section className={'filter-panel' + (showStatus ? ' filter-with-status' : '')} aria-label="Filtros do relatório">
    <div className="filter-heading"><ListFilter size={17} aria-hidden="true" /><h2>Filtros</h2></div>
    <label><span>Período</span><select value={value.period} onChange={(event) => patch('period', event.target.value)}><option value="">Todos</option>{options.periods.map((item) => <option key={item}>{item}</option>)}</select></label>
    <label><span>Modalidade</span><select value={value.modality} onChange={(event) => patch('modality', event.target.value)}><option value="">Todas</option>{options.modalities.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
    <label className="discipline-filter"><span>Disciplina</span><select value={value.courseId} onChange={(event) => patch('courseId', event.target.value)}><option value="">Todas as disciplinas</option>{options.courses.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
    <label className="search-field"><span>Docente ou disciplina</span><div><Search size={16} aria-hidden="true" /><input value={value.query} onChange={(event) => patch('query', event.target.value)} placeholder="Buscar…" /></div></label>
    {showStatus && <label><span>Situação das atividades</span><select value={value.status} onChange={(event) => patch('status', event.target.value)}><option value="">Todas</option><option value="PENDING">Todas as pendentes</option><option value="OVERDUE">Pendente em atraso</option><option value="WITHIN_DEADLINE">Pendente no prazo</option><option value="DELIVERED_ON_TIME">Entregue no prazo / antecipada</option><option value="DELIVERED_LATE">Entregue com atraso</option><option value="CRITICAL,NEVER">Acesso crítico / sem registro</option><option value="ATTENTION">Acesso em atenção</option><option value="CURRENT">Acesso em dia</option><option value="NOT_VERIFIABLE">A validar</option><option value="INHERITED_READY">Replicado no prazo</option><option value="NOT_APPLICABLE">Não aplicável</option></select></label>}
    <button className="clear-button" type="button" disabled={!dirty} onClick={() => onChange({ period: '', modality: '', courseId: '', status: '', requirementGroup: '', requirementId: '', query: '', page: 1 })}><RotateCcw size={15} />Limpar filtros</button>
  </section>;
}
