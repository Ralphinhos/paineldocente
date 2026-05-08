import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coordinator } from '../types';

interface AuthContextType {
    isAuthenticated: boolean;
    user: {
        name: string | null;
        role: string | null;
        courses: string[];
        username: string | null;
    } | null;
    login: (userData: Omit<AuthContextType['user'], 'isAuthenticated'>) => void;
    logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = React.useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth deve ser usado dentro de um AuthProvider');
    }
    return context;
};

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<AuthContextType['user']>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        // Na inicialização, verifica o localStorage para ver se já existe uma sessão
        try {
            const storedRole = localStorage.getItem('userRole');
            const storedName = localStorage.getItem('loggedInCoordinator');
            const storedCourses = JSON.parse(localStorage.getItem('coordinatorCourses') || '[]');
            const storedUsername = localStorage.getItem('loggedInCoordinatorUsername');

            if (storedRole && storedName) {
                setUser({
                    role: storedRole,
                    name: storedName,
                    courses: Array.isArray(storedCourses) ? storedCourses : [],
                    username: storedUsername,
                });
                setIsAuthenticated(true);
            }
        } catch (error) {
            console.error("Erro ao carregar dados de autenticação do localStorage", error);
            // Garante que o estado seja limpo em caso de erro
            localStorage.clear();
            setUser(null);
            setIsAuthenticated(false);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const login = useCallback((userData: Omit<AuthContextType['user'], 'isAuthenticated'>) => {
        localStorage.setItem('userRole', userData.role || '');
        localStorage.setItem('loggedInCoordinator', userData.name || '');
        localStorage.setItem('coordinatorCourses', JSON.stringify(userData.courses || []));
        if (userData.username) {
            localStorage.setItem('loggedInCoordinatorUsername', userData.username);
        }
        
        setUser(userData);
        setIsAuthenticated(true);
        navigate('/');
    }, [navigate]);

    const logout = useCallback(() => {
        localStorage.clear();
        setUser(null);
        setIsAuthenticated(false);
        navigate('/login');
    }, [navigate]);

    const value = {
        isAuthenticated,
        user,
        login,
        logout,
    };

    // Não renderiza os filhos até que a verificação inicial do localStorage seja concluída
    if (isLoading) {
        return null; // ou um <LoadingScreen /> global se preferir
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
