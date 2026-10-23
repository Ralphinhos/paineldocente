import type { EnvironmentRecord, MonitoringData, PageInfo } from './monitoring';
import type { QualityIssue } from './dashboard';

export interface ExecutiveTeacher {
  teacher: EnvironmentRecord['teacher']; access: EnvironmentRecord; courses: number;
  total: number; due: number; onTimeDue: number; lateDue: number; overdue: number;
  deliveredLate: number; pending: number; validation: number; maxOpenDays: number;
  onTimePercent: number | null; latePercent: number | null;
}
export interface ExecutiveFilters {
  period: string; modality: string; bimester: string; query: string; page: number;
  sort: 'late' | 'name' | 'access' | 'ontime'; snapshotId?: string;
}
export interface ExecutiveData {
  meta: { snapshotId: string; generatedAt: string; period: string; modality: string; bimester: string;
    source: 'demo' | 'moodle'; isDemo: boolean; qualityStatus: string; rulesVersion: string; rulesStatus: string;
    qualityIssues: QualityIssue[]; stale: boolean; deadlinesChanged: boolean };
  filters: { periods: string[]; modalities: Array<{ value: string; label: string }> };
  summary: { teachers: number; courses: number; due: number; onTimeDue: number; lateDue: number; accessAlerts: number;
    access: MonitoringData['access']['summary']; deliveries: MonitoringData['deliveries']['summary'] };
  topLate: ExecutiveTeacher[]; topOnTime: ExecutiveTeacher[];
  topAbsent: EnvironmentRecord[]; topRecent: EnvironmentRecord[];
  activities: MonitoringData['deliveries']['activityChart'];
  teachers: { rows: ExecutiveTeacher[]; pagination: PageInfo };
}
export interface SemesterPoint {
  snapshotId: string; generatedAt: string; total: number; onTime: number;
  overdue: number; deliveredLate: number; pending: number; validation: number;
}
export interface EvolutionDateRange { dateFrom: string; dateTo: string }
export interface ExecutiveHistory { snapshotId: string; range: EvolutionDateRange; points: SemesterPoint[] }
