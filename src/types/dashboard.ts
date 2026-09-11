export type Role = "ned_admin" | "coordinator" | "executive" | "auditor";
export interface User { id: string; name: string; email: string; role: Role }
export interface DemoProfile { id: string; name: string; role: Role }
export type SessionResponse = { authenticated: false; authMode: "demo" | "proxy"; demoEnabled: boolean; demoProfiles: DemoProfile[] } | { authenticated: true; user: User; csrfToken: string; authMode: "demo" | "proxy"; demoEnabled: boolean };
export type StructureStatus = "PENDING" | "DELIVERED_LATE" | "DELIVERED_ON_TIME" | "INHERITED_READY" | "NOT_APPLICABLE" | "NOT_VERIFIABLE";
export type AccessStatus = "CURRENT" | "ATTENTION" | "CRITICAL" | "NEVER" | "OUTSIDE_WINDOW";
export type Severity = "CRITICAL" | "ATTENTION" | "OK";
export interface Evidence { type: string; occurredAt: string; supports: string; note: string }
export interface DelayFacts { daysLate: number | null; observedLateDays: number | null; delayPrecision: "EXACT" | "OBSERVED" | "UNAVAILABLE" }
export interface RankingEntry {
  teacher: AssignmentRow["teacher"]; courseIds: string[]; courseCount: number;
  mode: "COMPOSITE" | "INCOMPLETE" | "ACCESS_ONLY" | "DELIVERY_ONLY" | "NO_BASIS";
  score: number | null; components: { onTime: number | null; delay: number | null; access: number | null };
  onTimePercent: number | null; averageDaysLate: number | null; dueItems: number; onTimeItems: number;
  overdue: number; deliveredLate: number; maxDaysLate: number; unverified: number; unassigned: number; imprecise: number;
  activeCourses: number; accessCritical: number; accessAttention: number; never: number; accessScore: number | null; maxDaysSinceAccess: number | null;
}
export interface RankingData {
  policy: { version: string; weights: { onTime: number; delay: number; access: number }; delayBands: Array<{ maxDays: number; points: number }>; accessPoints: Record<string, number> } | null;
  regularity: RankingEntry[]; priority: RankingEntry[]; access: RankingEntry[]; incomplete: RankingEntry[]; teachers: RankingEntry[]; needsValidation: number;
}
export interface Requirement extends DelayFacts { responsibleTeacherId: string | null; responsibility: "ASSIGNED" | "OTHER_TEACHER" | "UNCONFIRMED"; id: string; baseId: string; label: string; manualControl: boolean; itemNumber: number | null; evidenceType: "SENT_BY_TEACHER" | "RECORDED_BY_TEACHER" | null; status: StructureStatus; reasonCode: string; reason: string; overdue: boolean; deadlineAt: string | null; deadlineSource: string | null; configuredAt: string | null; timingSource: "DEMO_TRUSTED" | "SNAPSHOT_OBSERVED" | "MANUAL_NED" | null; expectedQuantity: number | null; observedQuantity: number; evidence: Evidence[]; manualEvidenceDate?: string | null; publishedDate?: string | null; manualJustification?: string | null; manualUpdatedBy?: string | null; manualUpdatedAt?: string | null; manualVersion?: number; manualReplacementReason?: string | null; manualRevisionDeadlineDate?: string | null }
export interface AssignmentRow {
  id: string;
  course: { id: string; name: string; shortName: string; period: string; modality: string; modalityLabel: string; workloadHours: number; startsAt: string; endsAt: string };
  teacher: { id: string; name: string; email: string | null };
  accessStatus: AccessStatus; lastAccessAt: string | null; daysSinceAccess: number | null;
  provenance: "INHERITED_VERIFIED" | "RESTORED_NOT_EXEMPT" | "CREATED_FOR_PERIOD";
  maxDaysLate: number; requirements: Requirement[]; severity: Severity; issueCount: number; dataQualityCount: number; primaryReason: string;
}
export interface QualityIssue { code: string; message: string; severity: "INFO" | "WARNING" | "CRITICAL"; courseId?: string }
export interface DashboardData {
  meta: { snapshotId: string; generatedAt: string; source: "demo" | "moodle"; isDemo: boolean; rulesVersion: string; rulesStatus: string; qualityStatus: "VALID" | "WARNING" | "BLOCKED"; publishAllowed: boolean; stale: boolean; qualityIssues: QualityIssue[] };
  ranking: RankingData;
  summary: { averageDaysLate: number | null; measuredLateItems: number; unmeasuredLateItems: number; monitoredTeachers: number; courses: number; requirements: { total: number; pending: number; overdue: number; deliveredLate: number; deliveredOnTime: number; inheritedReady: number; notApplicable: number; notVerifiable: number }; access: { current: number; attention: number; critical: number; never: number; outsideWindow: number } };
  trend: Array<{ generatedAt: string; critical: number; attention: number }>;
  modalityBreakdown: Array<{ modality: string; label: string; total: number; issues: number; compliant: number }>;
  rows: AssignmentRow[];
  filters: { periods: string[]; modalities: Array<{ value: string; label: string }>; courses: Array<{ value: string; label: string }> };
  pagination: { page: number; pageSize: number; total: number; pages: number };
}
export interface DashboardFilters { teacherId?: string; period: string; modality: string; courseId: string; status: string; query: string; page: number }
export interface ReportPreview { audience: "coordinators" | "executive"; reports: Array<{ snapshotId: string; publishAllowed: boolean; recipient: { name: string; email: string } | null; subject: string; text: string; html: string; blocker: string | null }> }
export type ManualDeliveryDisposition = "PENDING" | "DELIVERED" | "NOT_APPLICABLE";
export interface ManualDeliveryHistory {
  version: number;
  disposition: ManualDeliveryDisposition | "INHERITED_READY";
  evidenceDate: string | null;
  publishedDate: string | null;
  replacementReason: string | null;
  revisionDeadlineDate: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
}
export interface ManualDeliveryItem extends DelayFacts {
  id: string;
  course: AssignmentRow["course"];
  teacher: AssignmentRow["teacher"];
  requirement: Pick<Requirement, "id" | "baseId" | "label" | "manualControl" | "itemNumber" | "evidenceType">;
  status: StructureStatus;
  overdue: boolean;
  deadlineAt: string | null;
  disposition: ManualDeliveryDisposition;
  evidenceDate: string | null;
  publishedDate: string | null;
  justification: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
  version: number;
  replacementReason: string | null;
  revisionDeadlineDate: string | null;
  history: ManualDeliveryHistory[];
  editable: boolean;
  canCreateRevision: boolean;
}
export interface ManualDeliveryResponse {
  meta: { snapshotId: string; generatedAt: string };
  items: ManualDeliveryItem[];
  filters: { periods: string[]; courses: Array<{ value: string; label: string }> };
  pagination: { page: number; pageSize: number; total: number; pages: number };
}
