import { LogOut } from 'lucide-react';
import type { ReactNode } from 'react';
import { UnderlinedLink } from '@/components/ui/UnderlinedLink';
import { useAuth } from '@/contexts/auth';
import type { Role } from '@/types/dashboard';
import { summaryHref } from '@/lib/workspace';
const ROLE_LABELS: Record<Role, string> = { ned_admin: 'Equipe NED', executive: 'Alta Gestão' };
export function AppShell({ children, hasUnsavedChanges = false, header, workspace = 'ned' }: { children: ReactNode; hasUnsavedChanges?: boolean; header?: ReactNode; workspace?: 'ned' | 'executive' }) {
  const { user, authMode, logout } = useAuth();
  if (!user) return null;
  return <div className={'app-shell' + (header ? ' ned-workspace' : '')}>
    <UnderlinedLink className="skip-link" href="#conteudo">Ir para o conteúdo</UnderlinedLink>
    {header ? <header className="ned-app-header"><div className="ned-header-inner"><div className="ned-wordmark" aria-label="NED UNIFENAS"><strong>NED</strong><span>UNIFENAS</span></div>{header}<button className="ned-signout icon-button" type="button" disabled={hasUnsavedChanges} title={hasUnsavedChanges ? 'Salve ou descarte as alterações antes de sair' : user.name + ' · Sair'} onClick={() => void logout()} aria-label="Sair"><LogOut size={17} /></button></div></header> : <header className="topbar">
      <div className="brand-lockup"><strong>UNIFENAS · NED</strong></div>
      <div className="topbar-actions">{authMode === 'demo' && <span className="demo-pill">Demonstração</span>}<div className="user-summary"><strong>{ROLE_LABELS[user.role]}</strong><small>{user.name}</small></div><button className="icon-button" type="button" disabled={hasUnsavedChanges} title={hasUnsavedChanges ? 'Salve ou descarte as alterações antes de sair' : 'Sair'} onClick={() => void logout()} aria-label="Sair"><LogOut size={18} /></button></div>
    </header>}
    <main id="conteudo" className="page-wrap" tabIndex={-1}>
      {header && <div className="workspace-view-nav"><nav aria-label="Visões do painel">
        {hasUnsavedChanges ? <span aria-disabled="true" className={workspace === 'ned' ? 'is-current' : ''}>Visão NED</span> : <a href="/acompanhamento" aria-current={workspace === 'ned' ? 'page' : undefined}>{user.role === 'ned_admin' ? 'Visão NED' : 'Detalhamento'}</a>}
        {hasUnsavedChanges ? <span aria-disabled="true">Alta Gestão</span> : <a href={workspace === 'executive' ? '/gestao' : summaryHref(typeof window === 'undefined' ? '' : window.location.search)} aria-current={workspace === 'executive' ? 'page' : undefined}>Alta Gestão</a>}
      </nav><span className="workspace-role-label">{ROLE_LABELS[user.role]}{user.role === 'executive' ? ' · Consulta' : ''}</span></div>}
      {children}</main>
    <footer className="app-footer"><span>UNIFENAS · Núcleo de Educação a Distância</span><span className="interface-credit">Interface: <UnderlinedLink href="https://skiper-ui.com/" target="_blank" rel="noreferrer">Skiper UI</UnderlinedLink> · <UnderlinedLink href="https://github.com/nolly-studio/cult-ui" target="_blank" rel="noreferrer">Cult UI</UnderlinedLink></span></footer>
  </div>;
}
