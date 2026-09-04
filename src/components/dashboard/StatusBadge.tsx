import type { AccessStatus, Severity, StructureStatus } from "@/types/dashboard";

const LABELS: Record<AccessStatus | Severity | StructureStatus, string> = {
  CRITICAL: "Crítico", ATTENTION: "Atenção", OK: "Regular",
  CURRENT: "Em dia", NEVER: "Sem acesso", OUTSIDE_WINDOW: "Fora do período",
  PENDING: "Pendente", DELIVERED_LATE: "Entregue com atraso", DELIVERED_ON_TIME: "Entregue no prazo",
  INHERITED_READY: "Estrutura herdada", NOT_VERIFIABLE: "Não verificável",
};

export function StatusBadge({ status }: { status: AccessStatus | Severity | StructureStatus }) {
  return <span className={`status-badge status-${status.toLowerCase().replaceAll("_", "-")}`}>{LABELS[status]}</span>;
}
