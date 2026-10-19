import { ArrowRight, LockKeyhole } from 'lucide-react';
import { UnderlinedLink } from '@/components/ui/UnderlinedLink';
import { useAuth } from '@/contexts/auth';
export function LoginPage() {
  const { demoEnabled, demoProfiles, loginDemo, error } = useAuth();
  return <main className="login-page">
    <header className="login-brand"><img src="/logo_branca.png" alt="UNIFENAS" /><span>NED</span></header>
    <section className="login-card"><span className="eyebrow">UNIFENAS · NED</span><h1>Análise docente</h1><p>{demoEnabled ? 'Confira acessos, entregas e ocorrências em uma única área do NED.' : 'Acesse com sua conta institucional.'}</p>
      {error && <div className="page-error" role="alert">{error}</div>}
      {demoEnabled ? <div className="profile-list">{demoProfiles.filter((profile) => profile.role === 'ned_admin').map((profile) => <button type="button" onClick={() => void loginDemo(profile.id)} key={profile.id}><span><strong>Abrir demonstração do NED</strong><small>Acessos ao ambiente e entregas</small></span><ArrowRight size={18} aria-hidden="true" /></button>)}</div> : <UnderlinedLink className="primary-button login-action" href="/oauth2/start?rd=/"><LockKeyhole size={17} />Entrar com conta institucional</UnderlinedLink>}
      {demoEnabled && <p className="demo-notice"><strong>Dados fictícios.</strong> O envio de e-mails está desabilitado.</p>}
    </section><small className="support-line">Dificuldade de acesso? Procure o NED.</small>
  </main>;
}
