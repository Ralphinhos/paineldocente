const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
function saoPauloDate(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return value;
  const parts = dateFormatter.formatToParts(new Date(value));
  return ['year', 'month', 'day'].map((type) => parts.find((part) => part.type === type).value).join('-');
}
function calendarDays(later, earlier) {
  if (!later || !earlier) return null;
  return Math.round((Date.parse(`${saoPauloDate(later)}T00:00:00Z`) - Date.parse(`${saoPauloDate(earlier)}T00:00:00Z`)) / 86400000);
}
function delayFacts(row, asOf) {
  const status = row.structureStatus || row.status;
  const empty = { daysLate: null, observedLateDays: null, delayPrecision: 'UNAVAILABLE' };
  if (!row.deadlineAt || ['NOT_VERIFIABLE', 'NOT_APPLICABLE', 'INHERITED_READY'].includes(status)) return empty;
  if (status === 'PENDING') return { ...empty, daysLate: Math.max(0, calendarDays(asOf, row.deadlineAt)), delayPrecision: 'EXACT' };
  if (status === 'DELIVERED_ON_TIME') return { ...empty, daysLate: 0, delayPrecision: 'EXACT' };
  if (status === 'DELIVERED_LATE') {
    const days = calendarDays(row.manualEvidenceDate || row.configuredAt, row.deadlineAt);
    if (days === null) return empty;
    if (row.timingSource === 'SNAPSHOT_OBSERVED') return { ...empty, observedLateDays: Math.max(0, days), delayPrecision: 'OBSERVED' };
    return { ...empty, daysLate: Math.max(0, days), delayPrecision: 'EXACT' };
  }
  return empty;
}
function delayLabel(item) {
  const status = item.structureStatus || item.status;
  const count = (n) => `${n} dia${n === 1 ? '' : 's'}`;
  if (status === 'PENDING') return item.daysLate > 0 ? `Pendente há ${count(item.daysLate)}` : 'Dentro do prazo';
  if (status === 'DELIVERED_LATE') return item.daysLate !== null && item.daysLate !== undefined ? `Entregue com ${count(item.daysLate)} de atraso` : item.observedLateDays != null ? `Atraso confirmado; até ${count(item.observedLateDays)}` : 'Atraso sem duração comprovada';
  return { DELIVERED_ON_TIME: 'Entregue no prazo', INHERITED_READY: 'Material reaproveitado', NOT_APPLICABLE: 'Dispensado', NOT_VERIFIABLE: 'A validar' }[status] || 'A validar';
}
module.exports = { calendarDays, delayFacts, delayLabel, saoPauloDate };
