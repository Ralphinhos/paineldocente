import { ArrowRight, ChartNoAxesCombined, ClipboardCheck, LockKeyhole, Mail } from 'lucide-react';
import { UnderlinedLink } from '@/components/ui/UnderlinedLink';
import { useAuth } from '@/contexts/auth';
export function LoginPage() {
  const { demoEnabled, demoProfiles, loginDemo, error } = useAuth();
  return <div className="ned-workspace ned-login">
    <header className="ned-app-header"><div className="ned-header-inner"><div className="ned-wordmark" aria-label="NED UNIFENAS"><strong>NED</strong><span>UNIFENAS</span></div><span className="ned-login-label">Monitoramento Docente</span></div></header>
    <main className="ned-login-content">
      <section className="ned-login-intro"><span className="eyebrow">NÚCLEO DE EDUCAÇÃO A DISTÂNCIA</span><h1>O que precisa de atenção, em um só lugar.</h1><p>Acompanhe os docentes e prepare os avisos para cada coordenação.</p>
        <ul className="ned-login-features"><li><span className="login-feature-icon login-feature-blue"><ChartNoAxesCombined size={21} aria-hidden="true" /></span>Acessos ao ambiente</li><li><span className="login-feature-icon login-feature-green"><ClipboardCheck size={21} aria-hidden="true" /></span>Entregas e prazos</li><li><span className="login-feature-icon login-feature-amber"><Mail size={21} aria-hidden="true" /></span>Relatórios por coordenação</li></ul>
      </section>
      <section className="ned-login-card" aria-labelledby="login-title"><h2 id="login-title">{demoEnabled ? 'Escolha uma visão' : 'NED e Alta Gestão'}</h2><p>{demoEnabled ? 'Resumo do semestre para a gestão. Acompanhamento e registros para o NED.' : 'Entre com sua conta institucional autorizada.'}</p>
      {error && <div className="page-error" role="alert">{error}</div>}
      {demoEnabled ? <div className="demo-view-options">{demoProfiles.map((profile) => <button className={profile.role === 'ned_admin' ? 'primary-button' : 'secondary-button'} type="button" onClick={() => void loginDemo(profile.id)} key={profile.id}>{profile.role === 'ned_admin' ? 'Abrir demonstração do NED' : 'Abrir Alta Gestão'}<ArrowRight size={18} aria-hidden="true" /></button>)}</div> : <UnderlinedLink className="primary-button" href="/oauth2/start?rd=/"><LockKeyhole size={17} aria-hidden="true" />Entrar com conta institucional</UnderlinedLink>}
      {demoEnabled && <p className="demo-notice"><strong>Dados fictícios.</strong> O envio de e-mails está desabilitado.</p>}
      <small className="support-line">Dificuldade de acesso? Procure o NED.</small></section>
    </main><footer className="app-footer"><span>UNIFENAS · Núcleo de Educação a Distância</span></footer>
  </div>;
}
