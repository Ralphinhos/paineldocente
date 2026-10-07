import { ArrowRight, LockKeyhole } from 'lucide-react';
import { UnderlinedLink } from '@/components/ui/UnderlinedLink';
import { useAuth } from '@/contexts/auth';
import type { Role } from '@/types/dashboard';
const PROFILE_LABELS: Record<Role, string> = { ned_admin: 'Equipe NED', coordinator: 'Coordenação', executive: 'Alta gestão', auditor: 'Auditoria' };
const PROFILE_TEXT: Record<Role, string> = { ned_admin: 'Conferir entregas e preparar relatórios', coordinator: 'Acompanhar suas disciplinas', executive: 'Consultar o resumo e o ranking', auditor: 'Consultar dados e evidências' };
export function LoginPage() {
  const { demoEnabled, demoProfiles, loginDemo, error } = useAuth();
  return <main className="login-page">
    <header className="login-brand"><img src="/logo_branca.png" alt="UNIFENAS" /><span>NED</span></header>
    <section className="login-card"><span className="eyebrow">Controle docente</span><h1>Entregas e acessos</h1><p>{demoEnabled ? 'Escolha o perfil para testar o painel.' : 'Acesse com sua conta institucional.'}</p>
      {error && <div className="page-error" role="alert">{error}</div>}
      {demoEnabled ? <div className="profile-list">{demoProfiles.map((profile) => <button type="button" onClick={() => void loginDemo(profile.id)} key={profile.id}><span><strong>{PROFILE_LABELS[profile.role]}</strong><small>{PROFILE_TEXT[profile.role]}</small></span><ArrowRight size={18} aria-hidden="true" /></button>)}</div> : <UnderlinedLink className="primary-button login-action" href="/oauth2/start?rd=/"><LockKeyhole size={17} />Entrar com conta institucional</UnderlinedLink>}
      {demoEnabled && <p className="demo-notice"><strong>Dados fictícios.</strong> O envio de e-mails está desabilitado.</p>}
    </section><small className="support-line">Dificuldade de acesso? Procure o NED.</small>
  </main>;
}
