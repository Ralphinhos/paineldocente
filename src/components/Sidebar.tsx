import { Link, useNavigate } from 'react-router-dom'; // Adicionado Link
import React, { FC, useEffect, useState } from 'react';
import { KPIData } from '../types';

interface SidebarProps {
  kpis: KPIData;
  userRole: string | null;
  onNotification?: (action: string) => void; // Opcional, pois só admin usará
  isNotifying?: boolean; // Nova propriedade para controlar o estado de notificação
}

import { useAuth } from '../contexts/AuthContext'; // Importar o hook de autenticação

export const Sidebar: FC<SidebarProps> = ({ kpis, onNotification, isNotifying = false }) => {
  const { user } = useAuth(); // Consumir o usuário do contexto
  const userRole = user?.role;
  const loggedInCoordinatorName = user?.name;

  const shortenName = (name: string) => {
    if (typeof name !== 'string' || !name) return '';
    const parts = name.trim().split(/\s+/);
    return parts.length > 2 ? `${parts[0]} ${parts[parts.length - 1]}` : name;
  };

  // A classe .card da tag <style> em Index.tsx tem: background-color: rgba(30, 41, 59, 0.7); border: 1px solid rgba(55, 65, 81, 0.5); backdrop-filter: blur(12px); border-radius: 1rem;
  // Vamos adicionar text-center e um rounded-xl para os cards de KPI.
  const kpiCardClasses = "bg-[rgba(30,41,59,0.7)] border border-[rgba(55,65,81,0.5)] backdrop-blur-md p-4 text-center rounded-xl";
  // O card de nome do coordenador pode manter o estilo original ou ser ajustado similarmente.
  const coordinatorCardClasses = "bg-[rgba(30,41,59,0.5)] border border-[rgba(55,65,81,0.5)] backdrop-blur-md p-3 text-center mb-2 rounded-xl";
  // O card de Ações de Comunicação
  const actionsCardClasses = "bg-[rgba(30,41,59,0.7)] border border-[rgba(55,65,81,0.5)] backdrop-blur-md p-3 flex-grow flex flex-col rounded-xl"; // p-4 para p-3


  return (
    <aside className="w-72 bg-[#020617] border-r border-gray-800 p-4 flex flex-col space-y-4 overflow-y-auto"> {/* p-6 para p-4, space-y-6 para space-y-4 */}
      <div className="flex items-center justify-center mb-2"> {/* mb-4 para mb-2 */}
        <img
          src="/logo_branca.png"
          alt="logo_unifenas"
          className="h-16 w-auto" // h-20 para h-16
        />
      </div>

      {loggedInCoordinatorName && (
        <div className={coordinatorCardClasses}>
          <p className="text-xs text-cyan-400">{userRole === 'admin' ? 'Usuário:' : 'Coordenador(a):'}</p>
          <p className="text-sm font-semibold text-white">{shortenName(loggedInCoordinatorName)}</p>
        </div>
      )}

      {/* Link para o Relatório do Período REMOVIDO */}

      {/* KPIs da Modalidade Selecionada */}
      <div className={kpiCardClasses.replace('p-4', 'p-3')}>
        <p className="text-xs text-gray-400">Total Pendentes (Modalidade)</p>
        <p className="text-2xl font-bold text-[#ef4444]">
          {kpis.totalPendentesModalidade > 0 ? kpis.totalPendentesModalidade : (kpis.docenteMaiorMediaAtraso === undefined && kpis.totalPendentesModalidade === 0 ? "Selec. Mod." : kpis.totalPendentesModalidade)}
        </p>
      </div>
      <div className={kpiCardClasses.replace('p-4', 'p-3')}>
        <p className="text-xs text-gray-400">Total Atrasadas (Modalidade)</p>
        <p className="text-2xl font-bold text-[#f59e0b]">
          {kpis.totalAtrasadasModalidade > 0 ? kpis.totalAtrasadasModalidade : (kpis.docenteMaiorMediaAtraso === undefined && kpis.totalAtrasadasModalidade === 0 ? "Selec. Mod." : kpis.totalAtrasadasModalidade)}
        </p>
      </div>

      <div className={kpiCardClasses.replace('p-4', 'p-3')}>
        <p className="text-xs text-gray-400">Docente com Maior Atraso</p>
        {kpis.docenteMaiorMediaAtraso ? (
          <>
            <p className="text-base font-semibold text-orange-400">{shortenName(kpis.docenteMaiorMediaAtraso.nome)}</p>
            <p className="text-xl font-bold text-orange-400">Média: {kpis.docenteMaiorMediaAtraso.mediaDias}d</p>
          </>
        ) : (
          <p className="text-xl font-bold text-orange-400">{kpis.docenteMaiorMediaAtraso === undefined ? "Selec. Mod." : "-"}</p>
        )}
      </div>

      <div className={kpiCardClasses.replace('p-4', 'p-3')}>
        <p className="text-xs text-gray-400">Docente com Mais Pendências</p>
        {kpis.docenteMaisPendencias ? (
          <>
            <p className="text-base font-semibold text-indigo-400">{shortenName(kpis.docenteMaisPendencias.nome)}</p>
            <p className="text-xl font-bold text-indigo-400">{kpis.docenteMaisPendencias.quantidade} pendência(s)</p>
          </>
        ) : (
          <p className="text-xl font-bold text-indigo-400">{kpis.docenteMaisPendencias === undefined ? "Selec. Mod." : "-"}</p>
        )}
      </div>
      
      <div className={kpiCardClasses.replace('p-4', 'p-3')}>
        <p className="text-xs text-gray-400">Docente com Menos Acesso Recente</p>
        {kpis.docenteMenosAcesso ? (
          <>
            <p className="text-base font-semibold text-teal-400">{shortenName(kpis.docenteMenosAcesso.nome)}</p>
            {/* <p className="text-sm text-gray-300">Média: {kpis.docenteMenosAcesso.mediaDiasSemAcesso}d s/acesso</p> REMOVIDO */}
            <p className="text-xs text-gray-400" title={`${kpis.docenteMenosAcesso.disciplinaDestaque} (${kpis.docenteMenosAcesso.diasDisciplinaDestaque}d)`}>
                Destaque: {kpis.docenteMenosAcesso.disciplinaDestaque} ({kpis.docenteMenosAcesso.diasDisciplinaDestaque}d)
            </p>
          </>
        ) : (
          <p className="text-xl font-bold text-teal-400">{kpis.docenteMenosAcesso === undefined ? "Selec. Mod." : "-"}</p>
        )}
      </div>

      {/* Seção de Ações de Comunicação - VISÍVEL APENAS PARA ADMIN */}
      {userRole === 'admin' && onNotification && (
        <div className={actionsCardClasses}>
          <h3 className="text-sm font-semibold text-white mb-2 text-center">Ações de Comunicação</h3>
          <div className="space-y-2">
            <button 
              onClick={() => onNotification && onNotification('coordenadores')} 
              className="w-full text-sm py-2 px-4 bg-[#2b466d] text-white font-semibold rounded-md hover:bg-[#3c5f94] transition-colors disabled:opacity-50"
              disabled={isNotifying}
            >
              Notificar Coordenadores
            </button>
            <button 
              onClick={() => onNotification && onNotification('docentes')} 
              className="w-full text-sm py-2 px-4 bg-transparent border border-[#2b466d] text-[#adbbd1] hover:bg-[rgba(43,70,109,0.2)] font-semibold rounded-md transition-colors disabled:opacity-50"
              disabled={isNotifying}
            >
              Notificar Docentes
            </button>
            <button 
              onClick={() => onNotification && onNotification('cobrancaUas')} 
              className="w-full text-sm py-2 px-4 bg-transparent border border-[#00adc7] text-[#00adc7] hover:bg-[rgba(0,173,199,0.1)] font-semibold rounded-md transition-colors disabled:opacity-50"
              disabled={isNotifying}
            >
              ✨ Cobrar UAs Pendentes
            </button>
          </div>
        </div>
      )}

      {/* Card "Meus Cursos" foi removido conforme solicitado */}

      {/* Botão Sair removido daqui */}
    </aside>
  );
};
