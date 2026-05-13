import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { Login } from "./components/Login";
import RelatorioPeriodo from './components/RelatorioPeriodo';
import { ThemeProvider } from './contexts/ThemeContext';
import { DataProvider, useDataContext } from './contexts/DataContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoadingScreen } from './components/LoadingScreen';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1, 
      refetchOnWindowFocus: false, 
    },
  },
});

const PrivateRoute: React.FC<{ element: React.ReactElement }> = ({ element }) => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { isLoading: dataLoading } = useDataContext(); 
  const hasToken = !!localStorage.getItem('authToken');

  // 1. Trava dupla: Aguarda a validação do token E a busca inicial dos dados.
  // Impede completamente o acesso com os filtros em branco ou funções pela metade.
  if (hasToken && (authLoading || dataLoading)) {
    return (
      <LoadingScreen 
        message={authLoading ? "Conectando ao servidor..." : "Carregando disciplinas e filtros..."} 
      />
    );
  }

  // 2. Só libera o acesso à tela quando tudo estiver 100% carregado
  return isAuthenticated ? element : <Navigate to="/login" replace />;
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <DataProvider>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/" element={<PrivateRoute element={<Index />} />} />
                  <Route path="/relatorio-periodo" element={<PrivateRoute element={<RelatorioPeriodo />} />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </DataProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;