import type { DelayFacts, StructureStatus } from '@/types/dashboard';
function delayText(item: DelayFacts & { status: StructureStatus }) {
  const days = (n: number) => `${n} dia${n === 1 ? '' : 's'}`;
  if (item.status === 'PENDING') return item.daysLate && item.daysLate > 0 ? `Pendente há ${days(item.daysLate)}` : 'Dentro do prazo';
  if (item.status === 'DELIVERED_LATE') return item.daysLate != null ? `Entregue com ${days(item.daysLate)} de atraso` : item.observedLateDays != null ? `Atraso confirmado; até ${days(item.observedLateDays)}` : 'Duração a validar';
  return { DELIVERED_ON_TIME: 'Entregue no prazo', INHERITED_READY: 'Material reaproveitado', NOT_APPLICABLE: 'Dispensado', NOT_VERIFIABLE: 'A validar' }[item.status];
}
export function DelayLabel({ item }: { item: DelayFacts & { status: StructureStatus } }) {
  const tone = item.status === 'PENDING' && (item.daysLate || 0) > 0 ? 'danger' : item.status === 'DELIVERED_LATE' ? 'warning' : 'neutral';
  return <span className={`delay-label delay-${tone}`}>{delayText(item)}</span>;
}
