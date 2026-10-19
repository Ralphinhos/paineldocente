import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PageInfo } from '@/types/monitoring';
export function MonitoringPagination({ value, disabled, onChange }: { value: PageInfo; disabled: boolean; onChange: (page: number) => void }) {
  return <nav className="monitoring-pagination" aria-label="Páginas da lista"><span>{value.total} registro{value.total === 1 ? '' : 's'} · página {value.page} de {value.pages}</span><div><button className="secondary-button" type="button" disabled={disabled || value.page <= 1} onClick={() => onChange(value.page - 1)}><ChevronLeft size={16} />Anterior</button><button className="secondary-button" type="button" disabled={disabled || value.page >= value.pages} onClick={() => onChange(value.page + 1)}>Próxima<ChevronRight size={16} /></button></div></nav>;
}
