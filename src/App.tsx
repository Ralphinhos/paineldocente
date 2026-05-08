// import { Toaster } from "@/components/ui/toaster"; // Comentado - Usando Sonner
import { Toaster as Sonner } from "@/components/ui/sonner"; // Mantido - Sonner é o sistema de toast ativo
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { QueryClient } from "@tanstack/react-query";
import React, { useState, useEffect, ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { Login } from "./components/Login";
import RelatorioPeriodo from './components/RelatorioPeriodo';
import { LoadingScreen } from './components/LoadingScreen';
import { Coordinator } from './types';
import { ThemeProvider } from './contexts/ThemeContext';
import { DataProvider } from './contexts/DataContext';
import { AuthProvider, useAuth } from './contexts/AuthContext'; // Importar AuthProvider e useAuth

const queryClient = new QueryClient();

// O PrivateRoute agora usa o AuthContext para verificar a autenticação
const PrivateRoute: React.FC<{ element: React.ReactElement }> = ({ element }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? element : <Navigate to="/login" />;
};

// Componente que carrega os dados dos coordenadores e os disponibiliza
const CoordinatorLoader: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchCoordinators = async () => {
            try {
                const response = await fetch('/api/coordinators');
                if (!response.ok) throw new Error('Falha ao buscar dados de configuração.');
                const data = await response.json();
                localStorage.setItem('coordinatorsData', JSON.stringify(data));
            } catch (err) {
                setError((err as Error).message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchCoordinators();
    }, []);

    if (isLoading) return <LoadingScreen message="Carregando configurações..." />;
    if (error) return <div className="text-red-500 text-center p-4">{error}</div>;
    
    return <>{children}</>;
};


const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Sonner />
          <DataProvider>
            <BrowserRouter>
              <AuthProvider>
                <Routes>
                  <Route path="/login" element={<CoordinatorLoader><Login /></CoordinatorLoader>} />
                  <Route path="/" element={<PrivateRoute element={<Index />} />} />
                  <Route path="/relatorio-periodo" element={<PrivateRoute element={<RelatorioPeriodo />} />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </AuthProvider>
            </BrowserRouter>
          </DataProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;