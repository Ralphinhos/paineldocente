import { Filter, RotateCcw } from 'lucide-react';
import type { MonitoringData, MonitoringFilters as Filters } from '@/types/monitoring';
import { EMPTY_MONITORING_FILTERS } from '@/lib/monitoring';

export function MonitoringFilters({ value, options, disabled, onChange }: { value: Filters; options: MonitoringData['filters']; disabled: boolean; onChange: (filters: Filters) => void }) {
  const patch = (key: 'teacherId' | 'period' | 'modality' | 'courseId', next: string) => onChange({ ...value, [key]: next, page: 1 });
  const dirty = Boolean(value.teacherId || value.period || value.modality || value.courseId || value.query);
  return <section className="monitoring-filters" aria-label="Filtros das duas abas">
    <div className="monitoring-filter-heading"><h2><Filter size={19} aria-hidden="true" />Filtros</h2><button className="text-action filter-reset" type="button" disabled={disabled || !dirty} onClick={() => onChange(EMPTY_MONITORING_FILTERS)}><RotateCcw size={15} />Limpar filtros</button></div>
    <div className="monitoring-filter-fields">
    <label className="teacher-filter"><span>Docente</span><select disabled={disabled} value={value.teacherId} onChange={(event) => patch('teacherId', event.target.value)}><option value="">Todos os docentes</option>{options.teachers.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
    <label><span>Período</span><select disabled={disabled} value={value.period} onChange={(event) => patch('period', event.target.value)}><option value="">Todos</option>{options.periods.map((item) => <option key={item}>{item}</option>)}</select></label>
    <label><span>Modalidade</span><select disabled={disabled} value={value.modality} onChange={(event) => patch('modality', event.target.value)}><option value="">Todas</option>{options.modalities.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
    <label className="discipline-filter"><span>Disciplina</span><select disabled={disabled} value={value.courseId} onChange={(event) => patch('courseId', event.target.value)}><option value="">Todas as disciplinas</option>{options.courses.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
    </div>
  </section>;
}
