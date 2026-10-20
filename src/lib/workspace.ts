import { EMPTY_MONITORING_FILTERS } from './monitoring';
import type { MonitoringFilters } from '@/types/monitoring';
import type { ExecutiveFilters } from '@/types/executive';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function initialExecutiveFilters(search: string): ExecutiveFilters {
  const params = new URLSearchParams(search);
  return { period: params.get('period')?.slice(0, 50) || '', modality: ['SEMESTRAL', 'MODULAR', 'GRADUACAO_EAD'].includes(params.get('modality') || '') ? params.get('modality')! : '',
    bimester: ['1', '2'].includes(params.get('bimester') || '') ? params.get('bimester')! : '',
    snapshotId: uuid.test(params.get('snapshotId') || '') ? params.get('snapshotId')! : undefined,
    query: '', page: 1, sort: 'late' };
}

export function initialDetailFilters(search: string): MonitoringFilters {
  const params = new URLSearchParams(search);
  const access = params.get('accessStatus') || '';
  const delivery = params.get('deliveryStatus') || '';
  return { ...EMPTY_MONITORING_FILTERS,
    period: params.get('period')?.slice(0, 50) || '', modality: params.get('modality')?.slice(0, 50) || '',
    teacherId: params.get('teacherId')?.slice(0, 100) || '', activityKey: params.get('activityKey')?.slice(0, 200) || '',
    snapshotId: uuid.test(params.get('snapshotId') || '') ? params.get('snapshotId')! : undefined,
    accessScope: params.get('accessScope') === 'semester' ? 'semester' : 'active',
    bimester: ['1', '2'].includes(params.get('bimester') || '') ? params.get('bimester')! : '',
    deadlineScope: params.get('deadlineScope') === 'closed' ? 'closed' : 'all',
    accessStatus: ['ISSUES', 'ALERTS', 'ALL', 'CURRENT', 'ATTENTION', 'CRITICAL', 'NEVER', 'NOT_VERIFIABLE'].includes(access) ? access as MonitoringFilters['accessStatus'] : EMPTY_MONITORING_FILTERS.accessStatus,
    deliveryStatus: ['ALL', 'LATE_ALL', 'COMPLIANT', 'ON_TIME_OR_INHERITED', 'OVERDUE', 'PENDING', 'EARLY', 'ON_TIME', 'DELIVERED_LATE', 'INHERITED_READY', 'NOT_APPLICABLE', 'NOT_VERIFIABLE'].includes(delivery) ? delivery as MonitoringFilters['deliveryStatus'] : EMPTY_MONITORING_FILTERS.deliveryStatus,
  };
}

export function detailHref(scope: { period: string; modality?: string; bimester?: string; snapshotId: string }, extra: Record<string, string> = {}) {
  const params = new URLSearchParams({ ...scope, modality: scope.modality || '', bimester: scope.bimester || '', accessScope: 'semester', accessStatus: 'ALL', deliveryStatus: 'ALL', ...extra });
  for (const [key, value] of params) if (!value) params.delete(key);
  return '/acompanhamento?' + params.toString();
}

export function summaryHref(search: string) {
  const from = new URLSearchParams(search); const params = new URLSearchParams();
  for (const key of ['period', 'modality', 'bimester', 'snapshotId']) { const value = from.get(key); if (value) params.set(key, value); }
  return '/gestao' + (params.size ? '?' + params.toString() : '');
}
