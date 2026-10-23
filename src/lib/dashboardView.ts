import type { AssignmentRow, DashboardFilters, RankingEntry, Requirement } from '@/types/dashboard';

export function deliveryPercent(entry: RankingEntry): number | null {
  return ['COMPOSITE', 'DELIVERY_ONLY'].includes(entry.mode) && entry.dueItems > 0 ? entry.onTimePercent : null;
}

export function teacherChartData(entries: RankingEntry[]) {
  const teachers = entries.map((entry) => {
    const onTime = deliveryPercent(entry);
    return { entry, name: entry.teacher.name, onTime, late: onTime == null ? null : Math.round((100 - onTime) * 10) / 10, days: entry.activeCourses ? entry.maxDaysSinceAccess : null };
  });
  return {
    all: teachers,
    late: teachers.filter((item) => item.late != null && item.late > 0).sort((a, b) => (b.late ?? 0) - (a.late ?? 0) || a.name.localeCompare(b.name, 'pt-BR')).slice(0, 10),
    onTime: teachers.filter((item) => item.onTime != null).sort((a, b) => (b.onTime ?? 0) - (a.onTime ?? 0) || a.name.localeCompare(b.name, 'pt-BR')).slice(0, 10),
    absent: teachers.filter((item) => item.entry.activeCourses && (item.entry.never || item.days != null && item.days >= 8)).sort((a, b) => b.entry.never - a.entry.never || (b.days ?? -1) - (a.days ?? -1) || a.name.localeCompare(b.name, 'pt-BR')).slice(0, 10),
    present: teachers.filter((item) => item.entry.activeCourses && !item.entry.never && item.days != null).sort((a, b) => (a.days ?? 0) - (b.days ?? 0) || a.name.localeCompare(b.name, 'pt-BR')).slice(0, 10),
  };
}

export function matchesSheetItem(row: AssignmentRow, item: Requirement, filters: DashboardFilters): boolean {
  if (item.responsibility === 'OTHER_TEACHER') return false;
  if (filters.requirementId && item.baseId !== filters.requirementId) return false;
  const statuses = filters.status.split(',').filter(Boolean);
  if (!statuses.length || statuses.includes(row.accessStatus)) return true;
  return statuses.includes(item.status) || statuses.includes('OVERDUE') && item.status === 'PENDING' && item.overdue || statuses.includes('WITHIN_DEADLINE') && item.status === 'PENDING' && !item.overdue && Boolean(item.deadlineAt);
}

export function activityRows(rows: AssignmentRow[], filters: DashboardFilters) {
  return rows.flatMap((row) => row.requirements.filter((item) => matchesSheetItem(row, item, filters)).map((item) => ({ id: row.id + ':' + item.id, row, item })));
}

export function bimestreLabel(item: Pick<Requirement, 'id' | 'baseId' | 'label'>): string {
  const match = (item.baseId + ' ' + item.id + ' ' + item.label).match(/(?:bimestr(?:e|al)[_\s-]*(1|2)|(1|2)[º°ª]?\s*(?:bimestre|bim\b))/i);
  return match ? (match[1] || match[2]) + 'º' : '—';
}
