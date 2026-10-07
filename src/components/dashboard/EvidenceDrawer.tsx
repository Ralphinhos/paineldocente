import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { StatusBadge } from './StatusBadge';
import { DelayLabel } from './DelayLabel';
import { formatDate } from '@/lib/presentation';
import type { AssignmentRow } from '@/types/dashboard';

export function EvidenceDrawer({ row, onClose }: { row: AssignmentRow | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (row && !dialog.current?.open) dialog.current?.showModal();
    else if (!row) dialog.current?.close();
  }, [row]);
  return <dialog ref={dialog} className="evidence-dialog" onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} aria-labelledby="evidence-title">
    {row && <aside className="evidence-drawer">
      <header><div><h2 id="evidence-title">{row.course.name}</h2><p>{row.teacher.name} · {row.course.shortName}</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="Fechar evidências"><X size={20} /></button></header>
      <div className="drawer-body">
        <section className="access-panel"><div><span>Último acesso docente</span><StatusBadge status={row.accessStatus} /></div><p>{row.accessStatus === 'OUTSIDE_WINDOW' ? 'Disciplina fora do período ativo' : row.daysSinceAccess == null ? 'Sem acesso registrado no período' : 'Há ' + row.daysSinceAccess + ' dia(s)'}<br />{formatDate(row.lastAccessAt)}</p></section>
        <details className="evidence-help"><summary>Regras e origem dos dados</summary><p>UA usa envio do pacote; vídeo usa gravação. Publicação, visualização e alteração de conclusão não comprovam entrega. Material replicado e conferido aparece pronto no prazo; uma substituição abre nova versão.</p></details>
        <section className="requirements"><h3>Entregas da disciplina</h3>{row.requirements.filter((item) => item.responsibility !== 'OTHER_TEACHER').map((item) => <article className="requirement-card" key={item.id}>
          <div className="requirement-title"><strong>{item.label}{item.manualControl && (item.manualVersion || 1) > 1 ? ' · versão ' + item.manualVersion : ''}</strong><DelayLabel item={item} /></div>
          <div className="requirement-dates"><span>Prazo <b>{formatDate(item.deadlineAt, 'A validar')}</b></span><span>{item.evidenceType === 'SENT_BY_TEACHER' ? 'Envio' : item.evidenceType === 'RECORDED_BY_TEACHER' ? 'Gravação' : item.timingSource === 'SNAPSHOT_OBSERVED' ? 'Observada pronta' : 'Preparo'} <b>{formatDate(item.manualControl ? item.manualEvidenceDate : item.configuredAt)}</b></span></div>
          {item.responsibility === 'UNCONFIRMED' && !['INHERITED_READY', 'NOT_APPLICABLE'].includes(item.status) && <p className="no-events">Responsável a definir; fora da nota.</p>}
          <details className="requirement-evidence"><summary>Ver evidências</summary><p>{item.reason}</p>
            {item.delayPrecision === 'OBSERVED' && <p>A coleta comprova que o item ficou pronto até esta data. A duração exata fica fora da nota até validação.</p>}
            <p>{item.manualControl ? 'Publicação: ' + formatDate(item.publishedDate) + ' (sem efeito na nota)' : 'Quantidade: ' + item.observedQuantity + ' de ' + (item.expectedQuantity ?? '?')}</p>
            {item.manualReplacementReason && <p>Substituição: {item.manualReplacementReason}</p>}
            {item.manualJustification && <p>Justificativa: {item.manualJustification}</p>}
            {item.manualUpdatedBy && <p>Registrado por {item.manualUpdatedBy}</p>}
            {item.evidence.map((entry, index) => <p key={entry.type + '-' + index}><time>{formatDate(entry.occurredAt)}</time> · {entry.note}</p>)}
          </details>
        </article>)}</section>
      </div>
    </aside>}
  </dialog>;
}
