export interface DeadlineVersion {
  id: string; revision: number; createdAt: string; createdBy: string; reason: string; courseCount: number; changeCount: number;
}
export interface DeadlineView {
  meta: { snapshotId: string; version: DeadlineVersion | null; pendingCollection: boolean; isDemo: boolean };
  filters: {
    periods: string[]; modalities: Array<{ value: string; label: string }>;
    calendarGroups: Array<{ value: string; label: string }>;
    courses: Array<{ id: string; name: string; shortName: string; period: string; modality: string; workloadHours: number; calendarGroup: string | null }>;
  };
  scope: Array<{ id: string; name: string; shortName: string; workloadHours: number }>;
  requirements: Array<{ id: string; label: string; dates: string[]; mixed: boolean; individualCount: number | null; agendaOnly: boolean }>;
  referenceDates: Record<string, string>;
  history: DeadlineVersion[];
}
export interface DeadlineInput {
  snapshotId: string; expectedVersionId: string | null; period: string; modality: string; courseIds: string[];
  calendarGroup?: string; bimester?: string;
  changes: Array<{ requirementId: string; dates: string[] }>; reason: string;
}
export interface DeadlineReview {
  reviewToken: string; courseCount: number; changeCount: number;
  impact: Array<{ courseId: string; courseName: string; shortName: string; requirementId: string; label: string; before: string[]; after: string[]; hasOwnRevisionDeadline: boolean; kind?: 'GROUP' }>;
}
