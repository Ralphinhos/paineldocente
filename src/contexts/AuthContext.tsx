import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

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

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AuthContextType['user']>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
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
            console.error("Erro ao carregar dados de autenticação", error);
            // APENAS remove dados de auth em caso de corrupção, preserva temas e configs.
            localStorage.removeItem('userRole');
            localStorage.removeItem('loggedInCoordinator');
            localStorage.removeItem('coordinatorCourses');
            localStorage.removeItem('loggedInCoordinatorUsername');
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
        localStorage.removeItem('userRole');
        localStorage.removeItem('loggedInCoordinator');
        localStorage.removeItem('coordinatorCourses');
        localStorage.removeItem('loggedInCoordinatorUsername');
        localStorage.removeItem('sessionExpireTime');
        setUser(null);
        setIsAuthenticated(false);
        navigate('/login');
    }, [navigate]);

    if (isLoading) return null;

    return (
        <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};