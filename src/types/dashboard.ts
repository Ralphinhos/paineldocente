export type Role = "ned_admin" | "coordinator" | "executive" | "auditor";
export interface User { id: string; name: string; email: string; role: Role }
export interface DemoProfile { id: string; name: string; role: Role }
export type SessionResponse = { authenticated: false; authMode: "demo" | "proxy"; demoEnabled: boolean; demoProfiles: DemoProfile[] } | { authenticated: true; user: User; csrfToken: string; authMode: "demo" | "proxy"; demoEnabled: boolean };
export type StructureStatus = "PENDING" | "DELIVERED_LATE" | "DELIVERED_ON_TIME" | "INHERITED_READY" | "NOT_VERIFIABLE";
export type AccessStatus = "CURRENT" | "ATTENTION" | "CRITICAL" | "NEVER" | "OUTSIDE_WINDOW";
export type Severity = "CRITICAL" | "ATTENTION" | "OK";
export interface Evidence { type: string; occurredAt: string; supports: string; note: string }
export interface Requirement { id: string; label: string; status: StructureStatus; reasonCode: string; reason: string; overdue: boolean; deadlineAt: string | null; deadlineSource: string | null; configuredAt: string | null; timingSource: "DEMO_TRUSTED" | "SNAPSHOT_OBSERVED" | null; expectedQuantity: number | null; observedQuantity: number; evidence: Evidence[] }
export interface AssignmentRow {
  id: string;
  course: { id: string; name: string; shortName: string; period: string; modality: string; modalityLabel: string; workloadHours: number; startsAt: string; endsAt: string };
  teacher: { id: string; name: string; email: string | null };
  accessStatus: AccessStatus; lastAccessAt: string | null; daysSinceAccess: number | null;
  provenance: "INHERITED_VERIFIED" | "RESTORED_NOT_EXEMPT" | "CREATED_FOR_PERIOD";
  requirements: Requirement[]; severity: Severity; issueCount: number; primaryReason: string;
}
export interface QualityIssue { code: string; message: string; severity: "INFO" | "WARNING" | "CRITICAL"; courseId?: string }
export interface DashboardData {
  meta: { snapshotId: string; generatedAt: string; source: "demo" | "moodle"; isDemo: boolean; rulesVersion: string; rulesStatus: string; qualityStatus: "VALID" | "WARNING" | "BLOCKED"; publishAllowed: boolean; stale: boolean; qualityIssues: QualityIssue[] };
  summary: { monitoredTeachers: number; courses: number; requirements: { total: number; pending: number; overdue: number; deliveredLate: number; deliveredOnTime: number; inheritedReady: number; notVerifiable: number }; access: { current: number; attention: number; critical: number; never: number; outsideWindow: number } };
  trend: Array<{ generatedAt: string; critical: number; attention: number }>;
  modalityBreakdown: Array<{ modality: string; label: string; total: number; issues: number; compliant: number }>;
  rows: AssignmentRow[];
  filters: { periods: string[]; modalities: Array<{ value: string; label: string }>; courses: Array<{ value: string; label: string }> };
  pagination: { page: number; pageSize: number; total: number; pages: number };
}
export interface DashboardFilters { period: string; modality: string; courseId: string; status: string; query: string; page: number }
export interface ReportPreview { audience: "coordinators" | "executive"; reports: Array<{ recipient: { name: string; email: string } | null; subject: string; text: string; html: string; blocker: string | null }> }
