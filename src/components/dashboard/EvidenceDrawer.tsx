import { CalendarClock, CheckCircle2, History, KeyRound, MousePointerClick, X } from "lucide-react";
import { useEffect } from "react";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import type { AssignmentRow } from "@/types/dashboard";

function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "Não disponível"; }
function provenanceLabel(value: AssignmentRow["provenance"]) { return value === "INHERITED_VERIFIED" ? "Estrutura herdada e pronta antes da atribuição" : value === "RESTORED_NOT_EXEMPT" ? "Disciplina restaurada, sem isenção automática" : "Estrutura criada para o período"; }

export function EvidenceDrawer({ row, onClose }: { row: AssignmentRow | null; onClose: () => void }) {
  useEffect(() => { if (!row) return; const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; document.addEventListener("keydown", close); return () => document.removeEventListener("keydown", close); }, [row, onClose]);
  if (!row) return null;
  return <div className="drawer-layer" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><aside className="evidence-drawer" role="dialog" aria-modal="true" aria-labelledby="evidence-title">
    <header><div><span className="eyebrow">Trilha de evidências</span><h2 id="evidence-title">{row.teacher.name}</h2><p>{row.course.name}</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="Fechar"><X size={20} /></button></header>
    <div className="drawer-body">
      <section className="access-panel"><div><span>Acesso docente</span><StatusBadge status={row.accessStatus} /></div><dl><div><dt>Último acesso</dt><dd>{formatDate(row.lastAccessAt)}</dd></div><div><dt>Origem</dt><dd>{provenanceLabel(row.provenance)}</dd></div></dl></section>
      <div className="evidence-rule"><MousePointerClick size={18} /><p><strong>Regra de segurança:</strong> visualização ou “conclusão de atividade alterada” confirma interação, mas não comprova entrega. A prova principal é o estado atual da atividade.</p></div>
      <section className="requirements"><h3>Requisitos da disciplina</h3>{row.requirements.map((item) => <article className="requirement-card" key={item.id}><div className="requirement-title"><div><strong>{item.label}</strong><small>{item.reason}</small></div><StatusBadge status={item.status} /></div><dl className="requirement-facts"><div><dt><CalendarClock size={14} />Prazo oficial</dt><dd>{formatDate(item.deadlineAt)}</dd></div><div><dt><CheckCircle2 size={14} />Pronta observada</dt><dd>{formatDate(item.configuredAt)}{item.timingSource === "SNAPSHOT_OBSERVED" ? " · fotografia" : item.timingSource === "DEMO_TRUSTED" ? " · demonstração" : ""}</dd></div><div><dt><KeyRound size={14} />Quantidade</dt><dd>{item.observedQuantity} de {item.expectedQuantity ?? "?"}</dd></div></dl>{item.evidence.length > 0 ? <div className="event-list"><strong><History size={14} />Eventos preservados</strong>{item.evidence.map((evidence, index) => <div key={`${evidence.type}-${evidence.occurredAt}-${index}`}><span>{evidence.type.replaceAll("_", " ")}</span><time>{formatDate(evidence.occurredAt)}</time><small>{evidence.note}</small></div>)}</div> : <p className="no-events">Nenhum evento de apoio localizado.</p>}</article>)}</section>
    </div>
  </aside></div>;
}
