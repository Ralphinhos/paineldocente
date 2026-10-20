import { AuthProvider } from "@/contexts/AuthContext";
import { useAuth } from "@/contexts/auth";
import { DashboardPage } from "@/pages/DashboardPage";
import { LoginPage } from "@/pages/LoginPage";
import { ExecutivePage } from "@/pages/ExecutivePage";

function AppBody() {
  const { user, loading } = useAuth();
  if (loading) return <div className="app-loading"><span className="spinner" aria-hidden="true" /><p>Preparando painel…</p></div>;
  if (!user) return <LoginPage />;
  const summary = window.location.pathname === '/gestao' || (user.role === 'executive' && window.location.pathname !== '/acompanhamento');
  return summary ? <ExecutivePage /> : <DashboardPage />;
}

export default function App() {
  return <AuthProvider><AppBody /></AuthProvider>;
}
