import { deliveryPresentation } from '@/lib/presentation';
import type { DelayFacts, StructureStatus } from '@/types/dashboard';
export function DelayLabel({ item }: { item: DelayFacts & { status: StructureStatus; overdue?: boolean; deadlineAt?: string | null; configuredAt?: string | null; manualEvidenceDate?: string | null; evidenceDate?: string | null; timingSource?: string | null } }) {
  const result = deliveryPresentation(item);
  return <span className="delivery-state"><span className={'delivery-label delivery-' + result.tone}>{result.label}</span>{['PENDING', 'DELIVERED_LATE'].includes(item.status) && result.detail !== '—' && <small className="delay-detail">{result.detail}</small>}</span>;
}
