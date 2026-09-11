import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { RankingData, RankingEntry } from '@/types/dashboard';
const number = (value: number | null) => value == null ? '—' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value);
const modes = { COMPOSITE: 'Nota geral', ACCESS_ONLY: 'Somente acesso', INCOMPLETE: 'Base incompleta', DELIVERY_ONLY: 'Sem disciplinas ativas', NO_BASIS: 'Sem base vencida ou ativa' };
export function TeacherRanking({ data, onSelect }: { data: RankingData; onSelect: (entry: RankingEntry) => void }) {
  const [view, setView] = useState<'priority' | 'regularity' | 'access'>('priority');
  const [all, setAll] = useState(false);
  const entries = data[view];
  const shown = all ? entries : entries.slice(0, 5);
  if (!data.policy) return <section className="insight-section ranking-section"><h2>Ranking docente</h2><p>Atualize os dados para aplicar as novas regras.</p></section>;
  return <section className="insight-section ranking-section" aria-label="Ranking docente">
    <div className="section-heading compact"><div><h2>Ranking docente</h2><p>{data.regularity.length} docentes com nota geral · pesos 50 / 20 / 30</p></div><details className="ranking-help"><summary>Como é calculado?</summary><div>
      <p><strong>Prazo: 50 pontos.</strong> Percentual de entregas no prazo; média das disciplinas, com o mesmo peso para cada uma.</p>
      <p><strong>Atraso: 20 pontos.</strong> Média dos atrasos em cada disciplina com atraso, seguida da média entre elas. Sem atraso: 20; até 3 dias: 15; até 7: 10; até 14: 5; acima: 0. Pendências vencidas entram até a data da coleta.</p>
      <p><strong>Acesso: 30 pontos.</strong> Média das disciplinas ativas: 0–7 dias = 30; 8–14 = 15; 15+ ou sem registro = 0.</p>
      <p>Prazo ainda aberto, substitutiva, dispensa, publicação e material herdado ficam fora das entregas. Somente o responsável definido pontua. Base incompleta fica fora da nota geral.</p>
      <p>“Somente acesso” usa escala própria de 0 a 100. As notas não avaliam qualidade pedagógica. A média de atraso desta nota inclui pendências; o indicador do topo considera entregas concluídas.</p>
    </div></details></div>
    <nav className="segment-control" aria-label="Ordenação do ranking">{([['priority', 'Prioridade'], ['regularity', 'Melhor regularidade'], ['access', 'Acessos']] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={view === key} onClick={() => { setView(key); setAll(false); }}>{label}</button>)}</nav>
    <div className="ranking-list">
      {shown.map((entry, index) => {
        const score = view === 'access' ? entry.accessScore : entry.score;
        return <div className="ranking-row" key={entry.teacher.id}>
          <span className="rank-position">{index + 1}</span>
          <div className="rank-main"><button className="rank-name" type="button" onClick={() => onSelect(entry)}>{entry.teacher.name}<ArrowUpRight size={15} /></button>
            <div className="rank-track" aria-hidden="true"><span className={view === 'priority' ? 'rank-priority' : view === 'access' ? 'rank-access' : 'rank-regular'} style={{ width: `${score || 0}%` }} /></div>
            <small>{view === 'access' ? `${entry.accessCritical} acessos críticos · ${entry.activeCourses} disciplinas ativas${entry.never ? ` · ${entry.never} sem registro` : ''}` : `${entry.overdue} pendências vencidas · maior atraso ${entry.maxDaysLate} dias · ${entry.accessCritical} acessos críticos`}</small>
          </div>
          <div className="rank-score"><strong>{number(score)}<small>/100</small></strong><span>{view === 'access' ? 'Acesso' : 'Nota geral'}</span></div>
          <details className="rank-details"><summary>Ver cálculo</summary><div>
            <span>{entry.courseCount} disciplinas · {entry.dueItems} itens com prazo encerrado</span>
            <span>Prazo: {number(entry.components.onTime)}/50 · Atraso: {number(entry.components.delay)}/20 · Acesso: {number(entry.components.access)}/30</span>
            <span>{number(entry.onTimePercent)}% no prazo · atraso médio {number(entry.averageDaysLate)} dias · {modes[entry.mode]}</span>
            {entry.maxDaysSinceAccess != null && <span>Maior intervalo sem acesso: {entry.maxDaysSinceAccess} dias</span>}
          </div></details>
        </div>;
      })}
      {!shown.length && <div className="empty-inline">{view === 'priority' ? 'Nenhum docente com nota comparável exige acompanhamento.' : 'Ainda não há base comparável para esta classificação.'}</div>}
    </div>
    {entries.length > 5 && <button className="link-button ranking-more" type="button" onClick={() => setAll(!all)}>{all ? 'Mostrar Top 5' : `Ver todos (${entries.length})`}</button>}
    {data.teachers.some((entry) => entry.mode !== 'COMPOSITE') && <details className="ranking-exclusions"><summary>{data.teachers.filter((entry) => entry.mode !== 'COMPOSITE').length} docentes fora da nota geral</summary><div>{data.teachers.filter((entry) => entry.mode !== 'COMPOSITE').map((entry) => <button className="excluded-teacher" type="button" key={entry.teacher.id} onClick={() => onSelect(entry)}><strong>{entry.teacher.name}</strong><span>{modes[entry.mode]}{entry.unassigned ? ` · ${entry.unassigned} responsabilidades a definir` : ''}{entry.unverified || entry.imprecise ? ` · ${entry.unverified + entry.imprecise} dados a validar` : ''}</span></button>)}</div></details>}
  </section>;
}
