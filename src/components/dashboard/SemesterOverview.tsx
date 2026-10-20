import { CalendarCheck, CircleAlert, Clock3, Users } from 'lucide-react';
import { MonitoringMetrics } from './MonitoringMetrics';
import { DistributionChart } from './DistributionChart';
import { MonitoringChart, type ChartTone } from './MonitoringChart';
import { detailHref } from '@/lib/workspace';
import { formatPercent } from '@/lib/monitoringCharts';
import type { ExecutiveData } from '@/types/executive';

export function SemesterOverview({ data, disabled }: { data: ExecutiveData; disabled: boolean }) {
  const s = data.summary;
  const scope = data.meta;
  const open = (extra: Record<string, string>) => window.location.assign(detailHref(scope, extra));
  const teacher = (teacherId: string, extra: Record<string, string>) => open({ teacherId, section: 'deliveries', ...extra });
  const accessTone = (status: string): ChartTone => status === 'CRITICAL' ? 'rose' : status === 'ATTENTION' ? 'amber' : 'green';
  const lateBars = data.topLate.map((row) => ({ id: row.teacher.id, label: row.teacher.name, value: row.latePercent, valueLabel: formatPercent(row.latePercent),
    detail: `${row.lateDue} de ${row.due} prazos encerrados · ${row.overdue} pendente(s) vencida(s) · ${row.deliveredLate} entrega(s) com atraso`, tone: 'rose' as const }));
  const onTimeBars = data.topOnTime.map((row) => ({ id: row.teacher.id, label: row.teacher.name, value: row.onTimePercent, valueLabel: formatPercent(row.onTimePercent),
    detail: `${row.onTimeDue} de ${row.due} prazos encerrados · antecipadas e replicadas incluídas`, tone: 'green' as const }));
  const accessBars = (rows: ExecutiveData['topAbsent']) => rows.map((row) => ({ id: row.teacher.id, label: row.teacher.name, value: row.daysSinceAccess,
    detail: row.status === 'CURRENT' ? 'Em dia · último acesso ao ambiente' : row.status === 'ATTENTION' ? 'Atenção · 8–14 dias' : 'Crítico · 15 dias ou mais', tone: accessTone(row.status) }));
  return <div className="monitoring-view executive-overview">
    <MonitoringMetrics label="Resumo do semestre" disabled={disabled || !s.teachers} showDetail metrics={[
      { label: 'Docentes no semestre', value: s.teachers, detail: `${s.courses} disciplinas no recorte`, tone: 'blue', icon: Users, selected: false, onClick: () => open({ section: 'access' }) },
      { label: 'Entregas no prazo', value: s.onTimeDue, total: s.due, detail: `${s.onTimeDue} de ${s.due} prazos encerrados`, tone: 'green', icon: CalendarCheck, selected: false, onClick: () => open({ section: 'deliveries', deliveryStatus: 'COMPLIANT', deadlineScope: 'closed' }) },
      { label: 'Pendências vencidas', value: s.deliveries.overdue, total: s.due, detail: `${s.deliveries.deliveredLate} entregas com atraso já resolvidas`, tone: 'rose', icon: Clock3, selected: false, onClick: () => open({ section: 'deliveries', deliveryStatus: 'OVERDUE' }) },
      { label: 'Acessos em alerta', value: s.accessAlerts, total: s.access.total, detail: 'Atenção, crítico ou sem registro', tone: 'amber', icon: CircleAlert, selected: false, onClick: () => open({ section: 'access', accessStatus: 'ALERTS' }) },
    ]} />
    {!s.teachers ? <section className="ned-panel executive-empty"><h2>Nenhum docente neste recorte</h2><p>Selecione outra modalidade ou semestre.</p></section> : <>
      <div className="monitoring-charts executive-distributions">
        <DistributionChart title="Situação das entregas" unit="itens" disabled={disabled} onSelect={(deliveryStatus) => open({ section: 'deliveries', deliveryStatus })}
          note="Estados exclusivos. Antecipadas e replicadas entram em dia; dispensas ficam fora da base."
          slices={[
            { id: 'COMPLIANT', label: 'Entregues no prazo', value: s.deliveries.early + s.deliveries.onTime + s.deliveries.inherited, tone: 'green' },
            { id: 'OVERDUE', label: 'Pendentes vencidas', value: s.deliveries.overdue, tone: 'rose' },
            { id: 'DELIVERED_LATE', label: 'Entregues com atraso', value: s.deliveries.deliveredLate, tone: 'amber' },
            { id: 'PENDING', label: 'Pendentes no prazo', value: s.deliveries.pendingInTime, tone: 'blue' },
            { id: 'NOT_VERIFIABLE', label: 'A validar pelo NED', value: s.deliveries.validation, tone: 'slate' },
          ]} />
        <DistributionChart title="Acessos ao ambiente" unit="docentes" disabled={disabled} onSelect={(accessStatus) => open({ section: 'access', accessStatus })}
          note="Um registro por docente na data da coleta. Inclui quem ministrou disciplinas do semestre, mesmo já encerradas."
          slices={[
            { id: 'CURRENT', label: 'Em dia · 0–7 dias', value: s.access.current, tone: 'green' },
            { id: 'ATTENTION', label: 'Atenção · 8–14 dias', value: s.access.attention, tone: 'amber' },
            { id: 'CRITICAL', label: 'Crítico · 15+ dias', value: s.access.critical, tone: 'rose' },
            { id: 'NEVER', label: 'Sem registro', value: s.access.never, tone: 'purple' },
            { id: 'NOT_VERIFIABLE', label: 'A validar pelo NED', value: s.access.validation, tone: 'slate' },
          ]} />
      </div>
      <div className="executive-section-title"><h2>Comparações entre docentes</h2><span>Top 10 · clique para detalhar</span></div>
      <div className="monitoring-charts executive-rankings">
        <MonitoringChart title="Maior proporção de atrasos" description="Pendências vencidas e entregas concluídas com atraso" unit="% dos prazos encerrados" scaleMax={100} bars={lateBars} disabled={disabled} actionLabel="Abrir detalhamento" empty="Nenhum atraso confirmado neste recorte" onSelect={(id) => teacher(id, { deliveryStatus: 'LATE_ALL', deadlineScope: 'closed' })} footnote="Base: itens com prazo encerrado e resultado verificável. Empates priorizam a maior quantidade de itens." />
        <MonitoringChart title="Maior proporção no prazo" description="Entregas pontuais, antecipadas e materiais replicados" unit="% dos prazos encerrados" scaleMax={100} bars={onTimeBars} disabled={disabled} actionLabel="Abrir detalhamento" empty="Ainda sem entregas com prazo encerrado" onSelect={(id) => teacher(id, { deliveryStatus: 'COMPLIANT', deadlineScope: 'closed' })} footnote="Mesma base do gráfico de atrasos. O tooltip mostra a quantidade de itens avaliada." />
        <MonitoringChart title="Mais dias sem acesso" description="Docentes em atenção ou situação crítica" unit="dias sem acessar" bars={accessBars(data.topAbsent)} disabled={disabled} actionLabel="Abrir detalhamento" empty="Nenhum acesso medido em atenção ou crítico" onSelect={(teacherId) => open({ section: 'access', teacherId })} footnote="Último acesso ao ambiente na data da coleta. Sem registro e data desconhecida aparecem na distribuição." />
        <MonitoringChart title="Acessos mais recentes" description="Menor tempo desde o último acesso ao ambiente" unit="dias sem acessar" bars={accessBars(data.topRecent)} disabled={disabled} actionLabel="Abrir detalhamento" empty="Nenhum acesso medido na faixa em dia" onSelect={(teacherId) => open({ section: 'access', teacherId })} footnote="Zero significa acesso no dia da coleta. Recência não mede a quantidade de acessos do docente." />
      </div>
    </>}
  </div>;
}
