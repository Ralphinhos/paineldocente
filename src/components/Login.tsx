// src/components/Login.tsx
import React, { useState } from 'react';
import { User, Lock, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      if (!response.ok) {
        // Verifica se é um erro de servidor dormindo (Render acordando)
        if (response.status === 502 || response.status === 503 || response.status === 504) {
          setError('O servidor está acordando após um período inativo. Por favor, aguarde uns 40 segundos e tente novamente.');
          return;
        }

        // Se for um erro 401 ou 400 normal de senha errada
        const body = await response.json().catch(() => ({}));
        setError(body?.error || body?.message || 'Usuário ou senha inválidos.');
        return;
      }

      const data = await response.json();
      const { token, ...user } = data;
      login(user, token);

    } catch (error) {
      setError('O servidor demorou a responder (está acordando). Aguarde um minuto e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-[#0f172a] text-gray-200">
      <div className="p-8 bg-[#020617] rounded-lg shadow-xl w-96">
        <div className="flex justify-center mb-8">
          <img src="/logo_branca.png" alt="Logo" className="h-20 w-auto" />
        </div>

        {error && (
          <p role="alert" className="text-red-500 text-center mb-4 text-sm font-medium">
            {error}
          </p>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <User className="h-5 w-5 text-gray-400" />
            </div>
            <input
              id="username"
              aria-label="Nome de usuário"
              type="text"
              placeholder="Login"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-3 pl-10 bg-[#1e293b] rounded-md text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
              autoFocus
              disabled={loading}
            />
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-gray-400" />
            </div>
            <input
              id="password"
              aria-label="Senha"
              type="password"
              placeholder="Senha"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 pl-10 bg-[#1e293b] rounded-md text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full p-3 bg-cyan-600 hover:bg-cyan-700 rounded-md text-white font-semibold transition-colors disabled:bg-gray-500 flex justify-center items-center"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
};