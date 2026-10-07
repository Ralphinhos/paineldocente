import type { DelayFacts, StructureStatus } from '@/types/dashboard';
const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' });
function validCivilDate(value: string) {
  const parsed = new Date(value + 'T12:00:00Z');
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
export function formatDate(value: string | null | undefined, empty = '—') {
  if (!value) return empty;
  if (/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) {
    if (!validCivilDate(value)) return empty;
    const [year, month, day] = value.split('-');
    return day + '/' + month + '/' + year;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? empty : dateFormatter.format(date);
}
function civilDate(value: string | null | undefined) {
  if (!value) return null;
  if (/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return validCivilDate(value) ? value : null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(date);
}
type Delivery = DelayFacts & { status: StructureStatus; overdue?: boolean; deadlineAt?: string | null; configuredAt?: string | null; evidenceDate?: string | null; manualEvidenceDate?: string | null; timingSource?: string | null };
export function deliveryPresentation(item: Delivery) {
  const days = (value: number) => value + ' dia' + (value === 1 ? '' : 's');
  if (item.status === 'PENDING') {
    if (item.overdue || (item.daysLate != null && item.daysLate > 0)) return { label: 'Pendente em atraso', detail: item.daysLate == null ? 'Dias a validar' : days(item.daysLate) + ' de atraso', tone: 'danger' };
    const knownDeadline = Boolean(civilDate(item.deadlineAt));
    return { label: knownDeadline ? 'Pendente no prazo' : 'Prazo a validar', detail: '—', tone: knownDeadline ? 'info' : 'muted' };
  }
  if (item.status === 'DELIVERED_LATE') return { label: 'Entregue com atraso', detail: item.daysLate != null ? days(item.daysLate) : item.observedLateDays != null ? 'Até ' + days(item.observedLateDays) + ' · a validar' : 'Dias a validar', tone: 'warning' };
  if (item.status === 'DELIVERED_ON_TIME') {
    const delivered = civilDate(item.evidenceDate || item.manualEvidenceDate || item.configuredAt);
    const deadline = civilDate(item.deadlineAt);
    const exactDate = item.delayPrecision === 'EXACT' && item.timingSource !== 'SNAPSHOT_OBSERVED' && Boolean(item.evidenceDate || item.manualEvidenceDate || item.timingSource === 'DEMO_TRUSTED' || item.timingSource === 'MANUAL_NED');
    const early = exactDate && delivered && deadline && delivered < deadline;
    return { label: early ? 'Entregue antecipadamente' : 'Entregue no prazo', detail: '0 dias', tone: 'success' };
  }
  if (item.status === 'INHERITED_READY') return { label: 'Replicado no prazo', detail: 'Material reaproveitado', tone: 'success' };
  if (item.status === 'NOT_APPLICABLE') return { label: 'Não aplicável', detail: 'Dispensa justificada', tone: 'muted' };
  return { label: 'A validar', detail: 'Evidência incompleta', tone: 'info' };
}
