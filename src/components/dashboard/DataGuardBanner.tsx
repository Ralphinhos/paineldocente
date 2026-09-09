import { AlertTriangle, Database, ShieldAlert } from "lucide-react";
import type { DashboardData } from "@/types/dashboard";

export function DataGuardBanner({ meta }: { meta: DashboardData["meta"] }) {
  if (meta.isDemo) return <div className="guard-banner guard-demo"><Database size={20} /><div><strong>Dados 100% demonstrativos</strong><span>Nomes e disciplinas são fictícios. Nenhum e-mail externo pode ser enviado.</span></div></div>;
  if (!meta.publishAllowed) return <div className="guard-banner guard-blocked"><ShieldAlert size={20} /><div><strong>Publicação bloqueada</strong><span>Regras ou qualidade aguardam homologação. Use o painel apenas para conferência.</span></div></div>;
  if (meta.stale) return <div className="guard-banner guard-warning"><AlertTriangle size={20} /><div><strong>Coleta desatualizada</strong><span>Atualize os dados antes de tomar decisões.</span></div></div>;
  return null;
}
