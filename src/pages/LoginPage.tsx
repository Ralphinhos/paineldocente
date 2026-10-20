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
      <section className="ned-login-card" aria-labelledby="login-title"><h2 id="login-title">{demoEnabled ? 'Conheça o painel' : 'Acesso da equipe NED'}</h2><p>{demoEnabled ? 'Explore os gráficos, confira as pendências e teste os registros manuais.' : 'Entre com sua conta institucional autorizada.'}</p>
      {error && <div className="page-error" role="alert">{error}</div>}
      {demoEnabled ? demoProfiles.filter((profile) => profile.role === 'ned_admin').map((profile) => <button className="primary-button" type="button" onClick={() => void loginDemo(profile.id)} key={profile.id}>Abrir demonstração do NED<ArrowRight size={18} aria-hidden="true" /></button>) : <UnderlinedLink className="primary-button" href="/oauth2/start?rd=/"><LockKeyhole size={17} aria-hidden="true" />Entrar com conta institucional</UnderlinedLink>}
      {demoEnabled && <p className="demo-notice"><strong>Dados fictícios.</strong> O envio de e-mails está desabilitado.</p>}
      <small className="support-line">Dificuldade de acesso? Procure o NED.</small></section>
    </main><footer className="app-footer"><span>UNIFENAS · Núcleo de Educação a Distância</span></footer>
  </div>;
}
