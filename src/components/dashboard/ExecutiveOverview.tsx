import { TeacherCharts } from './TeacherCharts';
import { DeliveryCharts } from './DeliveryCharts';
import { TeacherRanking } from './TeacherRanking';
import { TeacherPerformanceTable } from './TeacherPerformanceTable';
import type { DashboardData, RankingEntry, VisualSelection } from '@/types/dashboard';

export function ExecutiveOverview({ data, onTeacher, onVisual }: { data: DashboardData; onTeacher: (entry: RankingEntry) => void; onVisual: (selection: VisualSelection) => void }) {
  return <div className="analytics-grid">
    <TeacherCharts data={data.ranking} onTeacher={onTeacher} />
    <DeliveryCharts data={data} onSelect={onVisual} />
    <TeacherRanking data={data.ranking} onSelect={onTeacher} />
    <TeacherPerformanceTable data={data.ranking} onSelect={onTeacher} />
  </div>;
}
