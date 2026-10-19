interface Bar { id: string; label: string; value: number; detail: string; tone: 'danger' | 'warning' }
export function MonitoringChart({ title, unit, bars, empty, onTeacher, disabled }: { title: string; unit: string; bars: Bar[]; empty: string; onTeacher: (id: string) => void; disabled: boolean }) {
  const max = Math.max(1, ...bars.map((bar) => bar.value));
  return <section className="occurrence-chart" aria-label={title}>
    <header><div><h2>{title}</h2><p>{unit} · até 10 docentes · clique para filtrar</p></div></header>
    {bars.length ? <div className="occurrence-bars">{bars.map((bar) => <button type="button" className="occurrence-bar" key={bar.id} disabled={disabled} onClick={() => onTeacher(bar.id)} aria-label={`${bar.label}: ${bar.value} ${unit}. ${bar.detail}. Filtrar docente.`}>
      <span className="bar-teacher">{bar.label}<small>{bar.detail}</small></span>
      <span className="occurrence-track" aria-hidden="true"><i className={'fill-' + bar.tone} style={{ width: bar.value / max * 100 + '%' }} /></span>
      <strong>{bar.value}<small>{unit}</small></strong>
    </button>)}</div> : <div className="chart-empty occurrence-chart-empty"><strong>{empty}</strong><span>{unit === 'dias' ? 'Registros a validar ou sem acesso registrado ficam identificados na lista.' : 'Entregas já realizadas e itens a validar ficam nas opções de situação da lista.'}</span></div>}
  </section>;
}
