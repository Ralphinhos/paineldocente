import React, { useState, useEffect } from 'react';
import { Coordinator } from '../types'; 
import { User, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext'; // Importar o hook useAuth

export const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
  const { login } = useAuth(); // Usar o contexto de autenticação

  useEffect(() => {
    const storedCoordinators = localStorage.getItem('coordinatorsData');
    if (storedCoordinators) {
      try {
        setCoordinators(JSON.parse(storedCoordinators));
      } catch (e) {
        setError("Erro ao carregar configuração.");
      }
    }
  }, []);

  const handleLogin = () => {
    setError('');
    const trimmedUsername = username.trim();

    // 1. Checar Admin
    if (trimmedUsername === 'admin' && password === 'admin') {
      login({
        name: 'Administrador',
        role: 'admin',
        courses: [], // Admin não tem cursos específicos
        username: 'admin',
      });
      return;
    }

    // 2. Checar Coordenador
    const lowercasedUsername = trimmedUsername.toLowerCase();
    const coordinator = coordinators.find(c => c.username.toLowerCase() === lowercasedUsername);

    if (coordinator && coordinator.password === password) {
      login({
        name: coordinator.fullName,
        role: 'coordinator',
        courses: coordinator.courses,
        username: coordinator.username,
      });
    } else {
      setError('Usuário ou senha inválidos.');
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); 
    handleLogin();
  };

  return (
    <div className="flex items-center justify-center h-screen bg-[#0f172a] text-gray-200">
      <div className="p-8 bg-[#020617] rounded-lg shadow-xl w-96">
        <div className="flex justify-center mb-8">
          <img src="/logo_branca.png" alt="Logo" className="h-20 w-auto" />
        </div>
        
        {error && <p className="text-red-500 text-center mb-4 text-sm">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <User className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Login"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-3 pl-10 bg-[#1e293b] rounded-md text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              autoFocus
            />
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 pl-10 bg-[#1e293b] rounded-md text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <button
            type="submit"
            className="w-full p-3 bg-cyan-600 hover:bg-cyan-700 rounded-md text-white font-semibold transition-colors disabled:bg-gray-500"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
};