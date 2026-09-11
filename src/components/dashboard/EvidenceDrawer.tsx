import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { StatusBadge } from './StatusBadge';
import { DelayLabel } from './DelayLabel';
import type { AssignmentRow } from '@/types/dashboard';
function formatDate(value: string | null) { if (!value) return '—'; if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.split('-').reverse().join('/'); return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(value)); }
export function EvidenceDrawer({ row, onClose }: { row: AssignmentRow | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (row) dialog.current?.showModal(); else dialog.current?.close(); }, [row]);
  return <dialog ref={dialog} className="evidence-dialog" onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} aria-labelledby="evidence-title">
    {row && <aside className="evidence-drawer"><header><div><h2 id="evidence-title">{row.teacher.name}</h2><p>{row.course.name}</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="Fechar"><X size={20} /></button></header><div className="drawer-body">
      <section className="access-panel"><div><span>Acesso docente</span><StatusBadge status={row.accessStatus} /></div><p>{row.daysSinceAccess == null ? 'Sem intervalo calculável no período ativo' : `Há ${row.daysSinceAccess} dias`} · {formatDate(row.lastAccessAt)}</p></section>
      <details className="evidence-help"><summary>Regras e origem dos dados</summary><p>UA usa envio do pacote; vídeo usa gravação. Publicação e logs de visualização ou conclusão não comprovam entrega. Material reaproveitado fica dispensado até uma substituição ser solicitada.</p></details>
      <section className="requirements"><h3>Entregas da disciplina</h3>{row.requirements.map((item) => <article className="requirement-card" key={item.id}>
        <div className="requirement-title"><strong>{item.label}{item.manualControl && (item.manualVersion || 1) > 1 ? ` · v${item.manualVersion}` : ''}</strong><DelayLabel item={item} /></div>
        <div className="requirement-dates"><span>Prazo <b>{formatDate(item.deadlineAt)}</b></span><span>{item.evidenceType === 'SENT_BY_TEACHER' ? 'Envio' : item.evidenceType === 'RECORDED_BY_TEACHER' ? 'Gravação' : item.timingSource === 'SNAPSHOT_OBSERVED' ? 'Observada pronta' : 'Conclusão'} <b>{formatDate(item.manualControl ? item.manualEvidenceDate || null : item.configuredAt)}</b></span></div>
        {item.responsibility !== 'ASSIGNED' && !['INHERITED_READY', 'NOT_APPLICABLE'].includes(item.status) && <p className="no-events">{item.responsibility === 'OTHER_TEACHER' ? 'Entrega atribuída a outro docente.' : 'Responsável a definir; fora da nota.'}</p>}
        <details className="requirement-evidence"><summary>Ver evidências</summary><p>{item.reason}</p>{item.delayPrecision === 'OBSERVED' && <p>A coleta comprova que o item ficou pronto até esta data. A duração exata permanece fora da nota até validação.</p>}
          <p>{item.manualControl ? `Publicação: ${formatDate(item.publishedDate || null)}` : `Quantidade: ${item.observedQuantity} de ${item.expectedQuantity ?? '?'}`}</p>
          {item.manualReplacementReason && <p>Substituição: {item.manualReplacementReason}</p>}{item.manualJustification && <p>Justificativa: {item.manualJustification}</p>}{item.manualUpdatedBy && <p>Registrado por {item.manualUpdatedBy}</p>}
          {item.evidence.map((evidence, index) => <p key={`${evidence.type}-${index}`}><time>{formatDate(evidence.occurredAt)}</time> · {evidence.note}</p>)}
        </details>
      </article>)}</section>
    </div></aside>}
  </dialog>;
}
