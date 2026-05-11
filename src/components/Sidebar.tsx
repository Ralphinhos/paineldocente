import React from 'react';
import { KPIData } from '../types';
import { AlertTriangle, Clock, UserX, Bell, Loader2 } from 'lucide-react';

interface SidebarProps {
  kpis: KPIData;
  userRole: string | null;
  onNotification: (action: string) => void;
  isNotifying: boolean;
}

const shortenName = (name: string) => {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  return parts.length > 2 ? `${parts[0]} ${parts[parts.length - 1]}` : name;
};

export const Sidebar: React.FC<SidebarProps> = ({ kpis, userRole, onNotification, isNotifying }) => {
  const cardBase = "p-4 rounded-lg border";
  const cardRed = `${cardBase} bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800`;
  const cardAmber = `${cardBase} bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800`;
  const cardSlate = `${cardBase} bg-slate-50 border-slate-200 dark:bg-slate-700/40 dark:border-slate-600`;

  return (
    <aside className="w-72 flex-shrink-0 h-screen overflow-y-auto bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-700 p-4 flex flex-col gap-4">
      {/* Logo */}
      <div className="flex items-center justify-center py-2 mb-2">
        <img src="/logo_branca.png" alt="Logo" className="h-12 w-auto hidden dark:block" />
        <img src="/logo.png" alt="Logo" className="h-12 w-auto dark:hidden" />
      </div>

      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
        Indicadores
      </h3>

      {/* Pendentes */}
      <div className={cardRed}>
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <span className="text-xs font-medium text-red-700 dark:text-red-400">Pendentes</span>
        </div>
        <p className="text-2xl font-bold text-red-600 dark:text-red-400">
          {kpis.totalPendentesModalidade}
        </p>
        <p className="text-xs text-red-500 dark:text-red-500 mt-1">atividades não entregues</p>
      </div>

      {/* Atrasadas */}
      <div className={cardAmber}>
        <div className="flex items-center gap-2 mb-1">
          <Clock className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Com Atraso</span>
        </div>
        <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
          {kpis.totalAtrasadasModalidade}
        </p>
        <p className="text-xs text-amber-500 dark:text-amber-500 mt-1">entregues fora do prazo</p>
      </div>

      {/* Docente sem acesso */}
      {kpis.docenteMenosAcesso && (
        <div className={cardSlate}>
          <div className="flex items-center gap-2 mb-1">
            <UserX className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Sem Acesso</span>
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-white truncate" title={kpis.docenteMenosAcesso.nome}>
            {shortenName(kpis.docenteMenosAcesso.nome)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {kpis.docenteMenosAcesso.diasDisciplinaDestaque} dias sem acesso
          </p>
        </div>
      )}

      {/* Docente mais pendências */}
      {kpis.docenteMaisPendencias && (
        <div className={cardRed}>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-xs font-medium text-red-700 dark:text-red-400">+ Pendências</span>
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-white truncate" title={kpis.docenteMaisPendencias.nome}>
            {shortenName(kpis.docenteMaisPendencias.nome)}
          </p>
          <p className="text-xs text-red-500 dark:text-red-400 mt-1">
            {kpis.docenteMaisPendencias.quantidade} pendência{kpis.docenteMaisPendencias.quantidade !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Docente maior média de atraso */}
      {kpis.docenteMaiorMediaAtraso && (
        <div className={cardAmber}>
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Maior Atraso</span>
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-white truncate" title={kpis.docenteMaiorMediaAtraso.nome}>
            {shortenName(kpis.docenteMaiorMediaAtraso.nome)}
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            média {kpis.docenteMaiorMediaAtraso.mediaDias} dias de atraso
          </p>
        </div>
      )}

      {/* Notificações — apenas admin */}
      {userRole === 'admin' && (
        <div className="mt-auto pt-4 border-t border-gray-200 dark:border-slate-700 space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
            Ações
          </h3>
          <button
            onClick={() => onNotification('Notificar Pendentes')}
            disabled={isNotifying}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 text-cyan-700 dark:bg-cyan-900/20 dark:hover:bg-cyan-900/40 dark:border-cyan-800 dark:text-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isNotifying
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Bell className="w-4 h-4" />
            }
            Notificar Docentes
          </button>
        </div>
      )}
    </aside>
  );
};