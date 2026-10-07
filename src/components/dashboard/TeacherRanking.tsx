import { useState } from 'react';
import { WorkspaceTabs } from '@/components/ui/WorkspaceTabs';
import type { RankingData, RankingEntry } from '@/types/dashboard';

const number = (value: number | null) => value == null ? '—' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value);
export function TeacherRanking({ data, onSelect }: { data: RankingData; onSelect: (entry: RankingEntry) => void }) {
  const [view, setView] = useState('regularity');
  const entries = (view === 'regularity' ? data.regularity : data.priority).slice(0, 10);
  const weights = data.policy?.weights;
  return <section className="chart-panel ranking-section" aria-labelledby="ranking-title">
    <header className="chart-heading"><div><h2 id="ranking-title">Ranking docente · nota geral</h2><p>Base completa · 0–100 pontos · Top 10</p></div></header>
    <WorkspaceTabs id="ranking" label="Ordenação do ranking" compact value={view} onChange={setView} tabs={[{ id: 'regularity', label: 'Maiores notas' }, { id: 'priority', label: 'Menores notas' }]} />
    <div className="chart-legend">{weights && <><span><i className="legend-ontime" />Prazo {weights.onTime}</span><span><i className="legend-late" />Atraso {weights.delay}</span><span><i className="legend-access" />Acesso {weights.access}</span></>}</div>
    {['regularity', 'priority'].map((key) => <div key={key} className="weighted-ranking" role="tabpanel" id={'ranking-panel-' + key} aria-labelledby={'ranking-tab-' + key} hidden={view !== key}>
      {view === key && entries.map((entry, index) => <button className="weighted-rank-row" type="button" key={entry.teacher.id} onClick={() => onSelect(entry)} aria-label={entry.teacher.name + ': ' + number(entry.score) + ' de 100 pontos. Prazo: ' + number(entry.components.onTime) + '; atraso: ' + number(entry.components.delay) + '; acesso: ' + number(entry.components.access) + '. Consultar atividades.'}>
        <span className="rank-position">{index + 1}</span><span className="weighted-name">{entry.teacher.name}</span><div className="horizontal-track" aria-hidden="true"><i className="legend-ontime" style={{ width: (entry.components.onTime ?? 0) + '%' }} /><i className="legend-late" style={{ width: (entry.components.delay ?? 0) + '%' }} /><i className="legend-access" style={{ width: (entry.components.access ?? 0) + '%' }} /></div><strong>{number(entry.score)}</strong>
      </button>)}
      {view === key && !entries.length && <div className="chart-empty"><strong>{data.policy ? 'Nenhum docente com nota comparável nesta seleção' : 'Ranking indisponível nesta coleta'}</strong><span>Dados incompletos ficam sem nota geral.</span></div>}
    </div>)}
    <details className="chart-data ranking-help"><summary>Ver critérios e pesos</summary><div><p>Prazo: {weights?.onTime ?? '—'} pontos. Atraso em dias: {weights?.delay ?? '—'}. Acesso: {weights?.access ?? '—'}. Cada disciplina tem o mesmo peso.</p><p>Antecipada vale o mesmo que no prazo. Prazo aberto, substitutiva, dispensa e material replicado não reduzem a nota de entregas. Replicadas continuam avaliadas pelos acessos.</p><p>Acesso: 0–7 dias em dia; 8–14 atenção; 15+ ou sem registro crítico. Base incompleta fica sem nota geral.</p></div></details>
    <div className="chart-footnote"><span>{data.regularity.length} docentes com nota geral</span><span>{data.teachers.filter((entry) => entry.mode !== 'COMPOSITE').length} com classificação separada na tabela</span></div>
  </section>;
}
