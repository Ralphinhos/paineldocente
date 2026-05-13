import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
    isAuthenticated: boolean;
    isLoading: boolean; // ADICIONADO: Exporta o estado de loading
    token: string | null;
    user: {
        name: string | null;
        role: string | null;
        courses: string[];
        username: string | null;
    } | null;
    login: (userData: Omit<AuthContextType['user'], 'isAuthenticated'>, token: string) => void;
    logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = React.useContext(AuthContext);
    if (!context) throw new Error('useAuth deve ser usado dentro de um AuthProvider');
    return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AuthContextType['user']>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const validateSession = async () => {
            const storedToken = localStorage.getItem('authToken');

            if (!storedToken) {
                setIsLoading(false);
                return;
            }

            try {
                // Se o backend demorar a acordar, isso vai esperar com segurança
                const response = await fetch('/api/validate-session', {
                    headers: { 'Authorization': `Bearer ${storedToken}` }
                });

                if (response.ok) {
                    const { user: decodedUser } = await response.json();
                    setUser({
                        name: decodedUser.name,
                        role: decodedUser.role,
                        courses: decodedUser.courses || [],
                        username: decodedUser.username
                    });
                    setToken(storedToken);
                    setIsAuthenticated(true);
                } else {
                    throw new Error('Sessão Inválida');
                }
            } catch (error) {
                console.error("Sessão inválida ou erro na conexão:", error);
                localStorage.removeItem('authToken');
                localStorage.removeItem('sessionExpireTime');
                setUser(null);
                setToken(null);
                setIsAuthenticated(false);
            } finally {
                setIsLoading(false);
            }
        };

        validateSession();
    }, []);

    const login = useCallback((userData: Omit<AuthContextType['user'], 'isAuthenticated'>, jwtToken: string) => {
        localStorage.setItem('authToken', jwtToken);
        localStorage.removeItem('sessionExpireTime');
        setToken(jwtToken);
        setUser(userData);
        setIsAuthenticated(true);
        navigate('/');
    }, [navigate]);

    const logout = useCallback(() => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('sessionExpireTime');
        setToken(null);
        setUser(null);
        setIsAuthenticated(false);
        navigate('/login');
    }, [navigate]);

    // ADICIONADO: Removemos o "if (isLoading) return null" para o fluxo fluir para o PrivateRoute do App.tsx

    return (
        <AuthContext.Provider value={{ isAuthenticated, isLoading, user, token, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};