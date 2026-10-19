import type { AssignmentRow, DashboardData, Requirement } from './dashboard';

export type EnvironmentStatus = 'CURRENT' | 'ATTENTION' | 'CRITICAL' | 'NEVER' | 'NOT_VERIFIABLE';
export type DeliveryState = 'OVERDUE' | 'PENDING' | 'EARLY' | 'ON_TIME' | 'DELIVERED_LATE' | 'INHERITED_READY' | 'NOT_APPLICABLE' | 'NOT_VERIFIABLE';
export interface PageInfo { page: number; pages: number; pageSize: number; total: number }
export interface EnvironmentRecord {
  teacher: AssignmentRow['teacher']; courses: AssignmentRow['course'][];
  status: EnvironmentStatus; lastAccessAt: string | null; daysSinceAccess: number | null;
}
export interface DeliveryRecord {
  id: string; course: AssignmentRow['course']; teacher: AssignmentRow['teacher']; item: Requirement; displayStatus: DeliveryState;
}
export interface TeacherDeliveryOverview {
  teacher: AssignmentRow['teacher']; total: number; due: number; onTimeDue: number; maxDaysLate: number;
  overduePercent: number | null; onTimePercent: number | null;
  counts: { overdue: number; pendingInTime: number; deliveredLate: number; early: number; onTime: number; inherited: number; validation: number };
}
export interface MonitoringFilters {
  period: string; modality: string; courseId: string; teacherId: string; query: string; activityKey: string;
  accessStatus: 'ISSUES' | 'ALL' | EnvironmentStatus; deliveryStatus: 'ALL' | 'COMPLIANT' | 'ON_TIME_OR_INHERITED' | DeliveryState; page: number;
}
export interface MonitoringData {
  meta: DashboardData['meta'];
  filters: DashboardData['filters'] & { teachers: Array<{ value: string; label: string }> };
  access: {
    summary: { total: number; current: number; attention: number; critical: number; never: number; validation: number };
    rows: EnvironmentRecord[]; chart: EnvironmentRecord[]; pagination: PageInfo;
    panorama: Array<Pick<EnvironmentRecord, 'teacher' | 'status' | 'daysSinceAccess'>>;
    priorities: EnvironmentRecord[];
  };
  deliveries: {
    summary: { total: number; overdue: number; pendingInTime: number; deliveredLate: number; early: number; onTime: number; inherited: number; validation: number; notApplicable: number };
    rows: DeliveryRecord[];
    chart: Array<{ teacher: AssignmentRow['teacher']; overdue: number; maxDaysLate: number }>;
    teacherOverview: TeacherDeliveryOverview[];
    activityChart: Array<{ id: string; label: string; modality: string; overdue: number; due: number; maxDaysLate: number }>;
    pagination: PageInfo;
  };
}
