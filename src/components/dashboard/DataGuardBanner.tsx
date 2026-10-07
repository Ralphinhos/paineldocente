import { AlertTriangle, Database, ShieldAlert } from 'lucide-react';
import type { DashboardData } from '@/types/dashboard';
export function DataGuardBanner({ meta }: { meta: DashboardData['meta'] }) {
  if (meta.isDemo) return <div className="guard-banner guard-demo" role="note"><Database size={16} aria-hidden="true" /><span><strong>Dados fictícios.</strong> E-mails não serão enviados.</span></div>;
  if (!meta.publishAllowed) return <div className="guard-banner guard-blocked" role="status"><ShieldAlert size={16} aria-hidden="true" /><span><strong>Envio bloqueado.</strong> Dados ou prazos precisam de validação.</span></div>;
  if (meta.stale) return <div className="guard-banner guard-warning" role="status"><AlertTriangle size={16} aria-hidden="true" /><span>Dados desatualizados. Atualize a coleta antes de conferir.</span></div>;
  return null;
}
