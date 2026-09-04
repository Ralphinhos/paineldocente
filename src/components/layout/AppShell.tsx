import { LogOut, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/contexts/auth";
import type { Role } from "@/types/dashboard";

const ROLE_LABELS: Record<Role, string> = {
  ned_admin: "NED · Operação",
  coordinator: "Coordenação",
  executive: "Alta gestão",
  auditor: "Auditoria",
};

export function AppShell({ children }: { children: ReactNode }) {
  const { user, authMode, logout } = useAuth();
  if (!user) return null;
  return <div className="app-shell">
    <header className="topbar">
      <div className="brand-lockup">
        <img src="/logo_branca.png" alt="UNIFENAS" />
        <span className="brand-divider" aria-hidden="true" />
        <div><strong>Painel Docente</strong><small>Acompanhamento NED</small></div>
      </div>
      <div className="topbar-actions">
        {authMode === "demo" && <span className="demo-pill">Ambiente demonstrativo</span>}
        <div className="user-summary"><span className="user-avatar" aria-hidden="true">{user.name.slice(0, 1)}</span><span><strong>{user.name}</strong><small>{ROLE_LABELS[user.role]}</small></span></div>
        <button className="icon-button icon-button-dark" type="button" onClick={() => void logout()} aria-label="Sair"><LogOut size={18} /></button>
      </div>
    </header>
    <div className="context-strip"><ShieldCheck size={15} /><span>Dados protegidos · acesso conforme perfil · histórico imutável</span></div>
    <main className="page-wrap">{children}</main>
  </div>;
}
