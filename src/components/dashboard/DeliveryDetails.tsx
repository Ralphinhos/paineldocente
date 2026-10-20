import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { DelayLabel } from './DelayLabel';
import { formatDate } from '@/lib/presentation';
import type { DeliveryRecord } from '@/types/monitoring';

export function DeliveryDetails({ row, onClose }: { row: DeliveryRecord | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (row && !dialog.current?.open) dialog.current?.showModal();
    else if (!row) dialog.current?.close();
  }, [row]);
  return <dialog ref={dialog} className="delivery-details-dialog" aria-labelledby="delivery-details-title" onCancel={onClose} onClick={(event) => { if (event.target !== event.currentTarget) return; const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); }}>
    {row && <section><header><div><h2 id="delivery-details-title">{row.item.label}</h2><p>{row.teacher.name} · {row.course.name}</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="Fechar detalhes"><X size={19} /></button></header>
      <DelayLabel item={row.item} /><dl className="delivery-facts"><div><dt>Prazo</dt><dd>{formatDate(row.item.deadlineAt, 'A validar')}</dd></div><div><dt>{row.item.baseId === 'unidades_aprendizagem' ? 'Envio do pacote' : row.item.baseId === 'videos' ? 'Gravação' : row.item.timingSource === 'SNAPSHOT_OBSERVED' ? 'Observada pronta em' : 'Entrega'}</dt><dd>{formatDate(row.item.manualEvidenceDate || row.item.configuredAt)}</dd></div><div><dt>Origem</dt><dd>{row.item.manualControl ? 'Registro manual do NED' : 'Moodle · coleta automática'}</dd></div></dl>
      <p className="delivery-reason">{row.item.reason}</p>
      {row.item.evidence.length > 0 && <details className="evidence-details"><summary>Conferir evidências ({row.item.evidence.length})</summary><ul>{row.item.evidence.map((item, index) => <li key={item.type + index}><strong>{formatDate(item.occurredAt)}</strong><span>{item.note}</span></li>)}</ul></details>}
      {row.item.manualJustification && <p className="delivery-reason"><strong>Justificativa:</strong> {row.item.manualJustification}</p>}
      <p className="detail-footnote">Visualização e alteração de conclusão, isoladamente, não comprovam entrega.</p>
    </section>}
  </dialog>;
}
