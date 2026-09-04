import { createContext, useContext } from "react";
import type { DemoProfile, User } from "@/types/dashboard";
export interface AuthState { user: User | null; loading: boolean; csrfToken: string | null; authMode: "demo" | "proxy"; demoEnabled: boolean; demoProfiles: DemoProfile[]; error: string | null; loginDemo: (id: string) => Promise<void>; logout: () => Promise<void>; refreshSession: () => Promise<void> }
export const AuthContext = createContext<AuthState | null>(null);
export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error("useAuth fora de AuthProvider"); return context; }
