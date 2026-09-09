import { CalendarClock, CheckCircle2, History, KeyRound, MousePointerClick, X } from "lucide-react";
import { useEffect } from "react";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import type { AssignmentRow } from "@/types/dashboard";

function formatDate(value: string | null) { if (!value) return "Não disponível"; if (/^\d{4}-\d{2}-\d{2}$/.test(value)) { const [year, month, day] = value.split("-"); return `${day}/${month}/${year}`; } return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)); }
function provenanceLabel(value: AssignmentRow["provenance"]) { return value === "INHERITED_VERIFIED" ? "Estrutura herdada e pronta antes da atribuição" : value === "RESTORED_NOT_EXEMPT" ? "Disciplina restaurada, sem isenção automática" : "Estrutura criada para o período"; }

export function EvidenceDrawer({ row, onClose }: { row: AssignmentRow | null; onClose: () => void }) {
  useEffect(() => { if (!row) return; const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; document.addEventListener("keydown", close); return () => document.removeEventListener("keydown", close); }, [row, onClose]);
  if (!row) return null;
  return <div className="drawer-layer" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><aside className="evidence-drawer" role="dialog" aria-modal="true" aria-labelledby="evidence-title">
    <header><div><span className="eyebrow">Trilha de evidências</span><h2 id="evidence-title">{row.teacher.name}</h2><p>{row.course.name}</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="Fechar"><X size={20} /></button></header>
    <div className="drawer-body">
      <section className="access-panel"><div><span>Acesso docente</span><StatusBadge status={row.accessStatus} /></div><dl><div><dt>Último acesso</dt><dd>{formatDate(row.lastAccessAt)}</dd></div><div><dt>Origem</dt><dd>{provenanceLabel(row.provenance)}</dd></div></dl></section>
      <div className="evidence-rule"><MousePointerClick size={18} /><p><strong>Regra de segurança:</strong> o pacote de UAs usa a data de envio e cada videoaula usa a data de gravação registrada pelo NED. Logs de visualização ou conclusão comprovam somente acesso.</p></div>
      <section className="requirements"><h3>Requisitos da disciplina</h3>{row.requirements.map((item) => {
        const evidenceLabel = item.evidenceType === "SENT_BY_TEACHER" ? "Envio do docente" : item.evidenceType === "RECORDED_BY_TEACHER" ? "Gravação do docente" : "Pronta observada";
        const timingLabel = item.timingSource === "SNAPSHOT_OBSERVED" ? " · fotografia" : item.timingSource === "DEMO_TRUSTED" ? " · demonstração" : item.timingSource === "MANUAL_NED" ? " · registro NED" : "";
        return <article className="requirement-card" key={item.id}><div className="requirement-title"><div><strong>{item.label}{item.manualControl && ` · versão ${item.manualVersion || 1}`}</strong><small>{item.reason}</small></div><StatusBadge status={item.status} /></div><dl className="requirement-facts"><div><dt><CalendarClock size={14} />{item.manualControl && (item.manualVersion || 1) > 1 ? "Prazo da versão" : "Prazo oficial"}</dt><dd>{formatDate(item.deadlineAt)}</dd></div><div><dt><CheckCircle2 size={14} />{evidenceLabel}</dt><dd>{formatDate(item.manualControl ? item.manualEvidenceDate || null : item.configuredAt)}{timingLabel}</dd></div><div><dt><KeyRound size={14} />{item.manualControl ? "Publicação operacional" : "Quantidade"}</dt><dd>{item.manualControl ? formatDate(item.publishedDate || null) : `${item.observedQuantity} de ${item.expectedQuantity ?? "?"}`}</dd></div></dl>{item.manualReplacementReason && <p className="no-events"><strong>Motivo da nova versão:</strong> {item.manualReplacementReason}</p>}{item.manualJustification && <p className="no-events"><strong>Justificativa:</strong> {item.manualJustification}</p>}{item.evidence.length > 0 ? <div className="event-list"><strong><History size={14} />Evidências preservadas</strong>{item.evidence.map((evidence, index) => <div key={`${evidence.type}-${evidence.occurredAt}-${index}`}><span>{evidence.type.replaceAll("_", " ")}</span><time>{formatDate(item.manualControl ? evidence.occurredAt.slice(0, 10) : evidence.occurredAt)}</time><small>{evidence.note}</small></div>)}</div> : <p className="no-events">Nenhuma evidência adicional localizada.</p>}</article>;
      })}</section>
    </div>
  </aside></div>;
}
