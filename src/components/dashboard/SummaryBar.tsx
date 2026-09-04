import { AlertOctagon, BookOpenCheck, Clock3, EyeOff, UsersRound } from "lucide-react";
import type { DashboardData } from "@/types/dashboard";

export function SummaryBar({ summary }: { summary: DashboardData["summary"] }) {
  const metrics = [
    { label: "Disciplinas", value: summary.courses, icon: BookOpenCheck, tone: "neutral" },
    { label: "Docentes", value: summary.monitoredTeachers, icon: UsersRound, tone: "neutral" },
    { label: "Requisitos vencidos", value: summary.requirements.overdue, icon: Clock3, tone: "danger" },
    { label: "Acessos críticos", value: summary.access.critical + summary.access.never, icon: AlertOctagon, tone: "danger" },
    { label: "Não verificáveis", value: summary.requirements.notVerifiable, icon: EyeOff, tone: "warning" },
  ];
  return <section className="summary-bar" aria-label="Resumo do acompanhamento">{metrics.map(({ label, value, icon: Icon, tone }) => <div className={`summary-metric metric-${tone}`} key={label}><Icon size={20} aria-hidden="true" /><span><strong>{value}</strong><small>{label}</small></span></div>)}</section>;
}
