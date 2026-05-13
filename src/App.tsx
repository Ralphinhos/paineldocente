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
import { DataProvider } from './contexts/DataContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoadingScreen } from './components/LoadingScreen';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1, // Não fica tentando várias vezes se o Render estiver demorando
      refetchOnWindowFocus: false, // Evita travamentos ao trocar de aba
    },
  },
});

const PrivateRoute: React.FC<{ element: React.ReactElement }> = ({ element }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const hasToken = !!localStorage.getItem('authToken');

  // 1. Aguarda a validação do token (e o backend acordar) antes de tentar renderizar a tela.
  if (isLoading && hasToken) {
    return <LoadingScreen message="Conectando ao servidor..." />;
  }

  // 2. Se não estiver carregando, verifica se validou a sessão de fato.
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
              {/* O DataProvider agora só é envelopado se for necessário, para não disparar chamadas perdidas */}
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