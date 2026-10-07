import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { WorkspaceTabs } from '@/components/ui/WorkspaceTabs';
import type { RankingData, RankingEntry } from '@/types/dashboard';
const number = (value: number | null) => value == null ? '—' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value);
const modes = { COMPOSITE: 'Nota geral', ACCESS_ONLY: 'Somente acesso', INCOMPLETE: 'Base incompleta', DELIVERY_ONLY: 'Sem disciplinas ativas', NO_BASIS: 'Sem base vencida ou ativa' };
export function TeacherRanking({ data, onSelect }: { data: RankingData; onSelect: (entry: RankingEntry) => void }) {
  const [view, setView] = useState<'priority' | 'regularity' | 'access'>('priority');
  const [all, setAll] = useState(false);
  const entries = data[view];
  const shown = all ? entries : entries.slice(0, 5);
  if (!data.policy) return <section className="insight-section"><div className="section-heading"><h2>Ranking docente</h2></div><p className="empty-inline">Atualize a coleta para consultar o ranking.</p></section>;
  const weights = data.policy.weights;
  return <section className="insight-section ranking-section" aria-labelledby="ranking-title">
    <div className="section-heading"><div><h2 id="ranking-title">Ranking docente</h2><p>{data.regularity.length} docentes com nota geral comparável</p></div><span className="result-count">Top {shown.length || 0}</span></div>
    <WorkspaceTabs id="ranking" label="Ordenação do ranking" compact value={view} onChange={(next) => { setView(next as typeof view); setAll(false); }} tabs={[{ id: 'priority', label: 'Precisam de atenção' }, { id: 'regularity', label: 'Maior regularidade' }, { id: 'access', label: 'Acessos' }]} />
    {(['priority', 'regularity', 'access'] as const).map((key) => <div key={key} className="ranking-list" role="tabpanel" id={'ranking-panel-' + key} aria-labelledby={'ranking-tab-' + key} hidden={view !== key}>
      {view === key && shown.map((entry, index) => {
        const score = view === 'access' ? entry.accessScore : entry.score;
        return <div className="ranking-row" key={entry.teacher.id}>
          <span className="rank-position">{index + 1}</span>
          <div className="rank-main"><button className="rank-name text-action" type="button" onClick={() => onSelect(entry)}>{entry.teacher.name}<ArrowUpRight size={15} aria-hidden="true" /></button><small>{view === 'access' ? entry.activeCourses + ' disciplinas ativas · ' + entry.accessCritical + ' acessos críticos' : entry.overdue + ' pendentes em atraso · ' + entry.accessCritical + ' acessos críticos'}</small>
            <div className="rank-track" role="img" aria-label={'Pontuação: ' + number(score) + ' de 100'}><span className={view === 'access' ? 'rank-access' : view === 'priority' ? 'rank-priority' : 'rank-regular'} style={{ width: (score || 0) + '%' }} /></div>
          </div>
          <div className="rank-score"><strong>{number(score)}<small>/100</small></strong><span>{view === 'access' ? 'Acesso' : 'Nota geral'}</span></div>
          <details className="rank-details"><summary>Ver cálculo</summary><div><span>{entry.courseCount} disciplinas · {entry.dueItems} itens com prazo encerrado</span><span>Prazo: {number(entry.components.onTime)}/{weights.onTime} · Atraso: {number(entry.components.delay)}/{weights.delay} · Acesso: {number(entry.components.access)}/{weights.access}</span><span>{number(entry.onTimePercent)}% no prazo · atraso médio {number(entry.averageDaysLate)} dias · {modes[entry.mode]}</span>{entry.maxDaysSinceAccess != null && <span>Maior intervalo sem acesso: {entry.maxDaysSinceAccess} dias</span>}</div></details>
        </div>;
      })}
      {view === key && !shown.length && <p className="empty-inline">{view === 'priority' ? 'Nenhum docente com nota comparável exige acompanhamento.' : 'Não há base comparável para esta classificação.'}</p>}
    </div>)}
    {entries.length > 5 && <button className="text-action ranking-more" type="button" onClick={() => setAll(!all)}>{all ? 'Mostrar Top 5' : 'Ver todos (' + entries.length + ')'}</button>}
    <details className="ranking-help"><summary>Critérios do ranking</summary><div><p><strong>Prazo: {weights.onTime} pontos.</strong> Percentual de entregas no prazo, com o mesmo peso por disciplina. Entrega antecipada recebe a pontuação de entrega no prazo.</p><p><strong>Atraso: {weights.delay} pontos.</strong> Considera a duração. Pendências vencidas acumulam dias até a coleta; o atraso fica fixo após a entrega.</p><p><strong>Acesso: {weights.access} pontos.</strong> 0–7 dias em dia; 8–14 atenção; 15+ ou sem registro crítico.</p><p>Prazo aberto, substitutiva, dispensa, publicação e material replicado ficam fora do cálculo de entregas. Base incompleta fica sem nota geral. “Somente acesso” usa uma escala própria de 0 a 100.</p></div></details>
    {data.teachers.some((entry) => entry.mode !== 'COMPOSITE') && <details className="ranking-exclusions"><summary>{data.teachers.filter((entry) => entry.mode !== 'COMPOSITE').length} docentes com classificação separada</summary><div>{data.teachers.filter((entry) => entry.mode !== 'COMPOSITE').map((entry) => <button className="excluded-teacher" type="button" key={entry.teacher.id} onClick={() => onSelect(entry)}><strong>{entry.teacher.name}</strong><span>{modes[entry.mode]}{entry.unassigned ? ' · responsável a definir' : ''}{entry.unverified || entry.imprecise ? ' · dados a validar' : ''}</span></button>)}</div></details>}
  </section>;
}
