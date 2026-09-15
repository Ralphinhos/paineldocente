import { ArrowUpRight } from 'lucide-react';
import type { DashboardData } from '@/types/dashboard';

export interface ExecutiveVisualSelection { label: string; status: string; requirementGroup?: string }

const percent = (value: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value);
const accessStatus = (key: string) => key === 'CRITICAL' ? 'CRITICAL,NEVER' : key;

export function ExecutiveCharts({ data, onSelect }: { data: DashboardData['visuals']; onSelect: (selection: ExecutiveVisualSelection) => void }) {
  const maxOverdue = Math.max(1, ...data.overdue.items.map((item) => item.overdue));
  return <div className="executive-visual-grid">
    <section className="insight-section visual-card access-visual" aria-labelledby="access-visual-title">
      <div className="section-heading compact"><div><h2 id="access-visual-title">Como estão os acessos agora?</h2><p>Base: {data.access.total} vínculos ativos de docente × disciplina.</p></div></div>
      {data.access.total ? <>
        <div className="access-stack" aria-label="Distribuição dos acessos por faixa">
          {data.access.items.filter((item) => item.count > 0).map((item) => <button
            className={`access-segment access-${item.key.toLowerCase()}`}
            type="button"
            key={item.key}
            style={{ flexGrow: item.count }}
            aria-label={`${item.label}: ${item.count} de ${data.access.total}, ${percent(item.percent)}%`}
            onClick={() => onSelect({ label: `Acesso ${item.label.toLocaleLowerCase('pt-BR')}`, status: accessStatus(item.key) })}
          >{item.percent >= 12 && <span>{item.count}</span>}</button>)}
        </div>
        <div className="access-legend">
          {data.access.items.map((item) => <button type="button" key={item.key} disabled={!item.count} onClick={() => onSelect({ label: `Acesso ${item.label.toLocaleLowerCase('pt-BR')}`, status: accessStatus(item.key) })}>
            <i className={`access-dot access-${item.key.toLowerCase()}`} aria-hidden="true" />
            <span><strong>{item.label}</strong><small>{item.detail}</small></span>
            <b>{item.count} <small>({percent(item.percent)}%)</small></b>
            <ArrowUpRight size={15} aria-hidden="true" />
          </button>)}
        </div>
      </> : <div className="empty-inline">Nenhuma disciplina ativa nesta seleção.</div>}
    </section>

    <section className="insight-section visual-card overdue-visual" aria-labelledby="overdue-visual-title">
      <div className="section-heading compact"><div><h2 id="overdue-visual-title">Onde estão as entregas vencidas?</h2><p>{data.overdue.totalOverdue} vencidas em {data.overdue.totalDue} itens com prazo encerrado e dado verificável.</p></div></div>
      {data.overdue.items.length ? <div className="overdue-bars">
        {data.overdue.items.map((item) => <button type="button" key={item.key} disabled={!item.overdue} aria-label={`${item.label}: ${item.overdue} vencidas de ${item.due}, ${percent(item.percent)}%`} onClick={() => onSelect({ label: `Entregas vencidas · ${item.label}`, status: 'OVERDUE', requirementGroup: item.key })}>
          <span className="overdue-row-label"><strong>{item.label}</strong><small>{item.overdue} de {item.due} · {percent(item.percent)}%</small></span>
          <span className="overdue-track" aria-hidden="true"><i style={{ width: `${item.overdue / maxOverdue * 100}%` }} /></span>
          <b>{item.overdue}</b>
          <ArrowUpRight size={15} aria-hidden="true" />
        </button>)}
      </div> : <div className="empty-inline">Nenhum item com prazo encerrado nesta seleção.</div>}
      {data.overdue.unverified > 0 && <p className="validation-note"><strong>{data.overdue.unverified} a validar</strong> · separados do gráfico para não distorcer o resultado.</p>}
    </section>
  </div>;
}
