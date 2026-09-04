import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiRequest } from "@/api/client";
import { AuthContext } from "@/contexts/auth";
import type { DemoProfile, SessionResponse, User } from "@/types/dashboard";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"demo" | "proxy">("demo");
  const [demoEnabled, setDemoEnabled] = useState(false);
  const [demoProfiles, setDemoProfiles] = useState<DemoProfile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const applySession = useCallback((session: SessionResponse) => {
    setAuthMode(session.authMode);
    setDemoEnabled(session.demoEnabled);
    if (session.authenticated) {
      setUser(session.user);
      setCsrfToken(session.csrfToken);
      setDemoProfiles([]);
    } else {
      setUser(null);
      setCsrfToken(null);
      setDemoProfiles(session.demoProfiles);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      applySession(await apiRequest<SessionResponse>("/api/auth/session"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível verificar a sessão.");
    } finally {
      setLoading(false);
    }
  }, [applySession]);

  useEffect(() => { void refreshSession(); }, [refreshSession]);

  const loginDemo = useCallback(async (profileId: string) => {
    setLoading(true);
    setError(null);
    try {
      const session = await apiRequest<Extract<SessionResponse, { authenticated: true }>>("/api/auth/demo-login", {
        method: "POST",
        body: JSON.stringify({ profileId }),
      });
      applySession({ ...session, authMode: "demo", demoEnabled: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }, [applySession]);

  const logout = useCallback(async () => {
    try {
      await apiRequest<void>("/api/auth/logout", { method: "POST", csrfToken });
    } finally {
      setUser(null);
      setCsrfToken(null);
      if (authMode === "proxy") {
        window.location.assign(`/oauth2/sign_out?rd=${encodeURIComponent(`${window.location.origin}/`)}`);
      } else {
        await refreshSession();
      }
    }
  }, [authMode, csrfToken, refreshSession]);

  const value = useMemo(
    () => ({ user, loading, csrfToken, authMode, demoEnabled, demoProfiles, error, loginDemo, logout, refreshSession }),
    [user, loading, csrfToken, authMode, demoEnabled, demoProfiles, error, loginDemo, logout, refreshSession],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
