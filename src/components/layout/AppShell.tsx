import { LogOut } from 'lucide-react';
import type { ReactNode } from 'react';
import { UnderlinedLink } from '@/components/ui/UnderlinedLink';
import { useAuth } from '@/contexts/auth';
import type { Role } from '@/types/dashboard';
const ROLE_LABELS: Record<Role, string> = { ned_admin: 'Equipe NED', coordinator: 'Coordenação', executive: 'Alta gestão', auditor: 'Auditoria' };
export function AppShell({ children, hasUnsavedChanges = false }: { children: ReactNode; hasUnsavedChanges?: boolean }) {
  const { user, authMode, logout } = useAuth();
  if (!user) return null;
  return <div className="app-shell">
    <UnderlinedLink className="skip-link" href="#conteudo">Ir para o conteúdo</UnderlinedLink>
    <header className="topbar">
      <div className="brand-lockup"><img src="/logo_branca.png" alt="UNIFENAS" /><span className="brand-divider" aria-hidden="true" /><div><strong>Controle docente</strong><small>Núcleo de Educação a Distância</small></div></div>
      <div className="topbar-actions">{authMode === 'demo' && <span className="demo-pill">Demonstração</span>}<div className="user-summary"><strong>{ROLE_LABELS[user.role]}</strong><small>{user.name}</small></div><button className="icon-button icon-button-dark" type="button" disabled={hasUnsavedChanges} title={hasUnsavedChanges ? 'Salve ou descarte as alterações antes de sair' : 'Sair'} onClick={() => void logout()} aria-label="Sair"><LogOut size={18} /></button></div>
    </header>
    <main id="conteudo" className="page-wrap" tabIndex={-1}>{children}</main>
    <footer className="app-footer"><span>UNIFENAS · NED · Visual 2.0</span><span className="interface-credit">Interface: <UnderlinedLink href="https://skiper-ui.com/" target="_blank" rel="noreferrer">Skiper UI</UnderlinedLink> · <UnderlinedLink href="https://github.com/nolly-studio/cult-ui" target="_blank" rel="noreferrer">Cult UI</UnderlinedLink></span></footer>
  </div>;
}
