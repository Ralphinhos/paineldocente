import { AuthProvider } from "@/contexts/AuthContext";
import { useAuth } from "@/contexts/auth";
import { DashboardPage } from "@/pages/DashboardPage";
import { LoginPage } from "@/pages/LoginPage";

function AppBody() {
  const { user, loading } = useAuth();
  if (loading) return <div className="app-loading"><span className="spinner" aria-hidden="true" /><p>Preparando painel…</p></div>;
  return user ? <DashboardPage /> : <LoginPage />;
}

export default function App() {
  return <AuthProvider><AppBody /></AuthProvider>;
}
