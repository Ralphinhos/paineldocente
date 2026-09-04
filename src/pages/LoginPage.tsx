import { ArrowRight, Building2, CheckCircle2, LockKeyhole, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import type { Role } from "@/types/dashboard";

const PROFILE_TEXT: Record<Role, string> = { ned_admin: "Operação, qualidade e relatórios", coordinator: "Disciplinas sob sua coordenação", executive: "Indicadores e pontos críticos", auditor: "Consulta e trilha de evidências" };
export function LoginPage() {
  const { demoEnabled, demoProfiles, loginDemo, error } = useAuth();
  return <main className="login-page">
    <section className="login-intro"><img src="/logo_branca.png" alt="UNIFENAS" /><div><span className="login-kicker">Núcleo de Educação a Distância</span><h1>Acompanhamento docente com evidências claras.</h1><p>Um painel para separar entrega de estrutura, acesso do docente e qualidade dos dados — sem apontamentos frágeis.</p></div><ul><li><CheckCircle2 size={18} />Regras rastreáveis</li><li><CheckCircle2 size={18} />Visões por responsabilidade</li><li><CheckCircle2 size={18} />Envio protegido por validação</li></ul><small><ShieldCheck size={15} />Ambiente interno · acesso controlado</small></section>
    <section className="login-panel"><div className="login-card"><div className="login-icon"><Building2 /></div><span className="eyebrow">Painel Docente</span><h2>{demoEnabled ? "Escolha uma visão demonstrativa" : "Acesso institucional"}</h2><p>{demoEnabled ? "Dados abaixo são fictícios e servem apenas para homologação." : "Entre com sua conta institucional para acessar seu perfil."}</p>
      {error && <div className="login-error" role="alert">{error}</div>}
      {demoEnabled ? <div className="profile-list">{demoProfiles.map((profile) => <button type="button" onClick={() => void loginDemo(profile.id)} key={profile.id}><span><strong>{profile.name}</strong><small>{PROFILE_TEXT[profile.role]}</small></span><ArrowRight size={18} /></button>)}</div> : <a className="primary-button login-action" href="/oauth2/start?rd=/"><LockKeyhole size={17} />Entrar com conta institucional</a>}
      {demoEnabled && <div className="demo-notice"><strong>Modo demonstração</strong><span>Não usa senha, pessoas reais ou banco Moodle.</span></div>}
    </div><small className="support-line">Dificuldade de acesso? Procure o NED ou a TI institucional.</small></section>
  </main>;
}
