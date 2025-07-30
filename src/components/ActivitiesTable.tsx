
import React, { useMemo, FC, useState } from 'react'; // Adicionado useState
import { ProcessedData } from '../types';

interface ActivitiesTableProps {
    data: ProcessedData[];
    onDocenteSelect: (docente: string) => void;
    selectedDocente: string | null;
}

type ActivityFilter = "all" | "pending" | "late"; // Adicionado tipo de filtro

export const ActivitiesTable: FC<ActivitiesTableProps> = ({ data, onDocenteSelect, selectedDocente }) => {
    const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all"); // Adicionado estado do filtro

    const { docentesData, selectedDocenteActivities } = useMemo(() => {
        // const filteredData = data.filter(row => row.isPendente || row.isAtrasado); // Removido filtro inicial aqui
        
        // Agrupa por docente e recalcula contagens baseadas nas definições atualizadas de isPendente/isAtrasado
        const docentesMap = new Map<string, { pendentes: number; atrasadas: number; activities: ProcessedData[] }>();
        
        data.forEach(row => { // Itera sobre 'data' original
            if (!docentesMap.has(row.Docente)) {
                docentesMap.set(row.Docente, { pendentes: 0, atrasadas: 0, activities: [] });
            }
            const docenteData = docentesMap.get(row.Docente)!;
            docenteData.activities.push(row); // Adiciona todas as atividades do docente
            
            // As contagens de pendentes/atrasadas para a lista de docentes são baseadas nas flags do useDataProcessor
            if (row.isPendente) docenteData.pendentes++;
            if (row.isAtrasado) docenteData.atrasadas++; // isAtrasado agora significa "entregue com atraso"
        });

        // Filtra docentes que têm pelo menos uma pendência ou atraso (entregue com atraso)
        const docentesArray = Array.from(docentesMap.entries())
            .filter(([_, stats]) => stats.pendentes > 0 || stats.atrasadas > 0)
            .map(([docente, stats]) => ({
                docente,
                ...stats,
                // A criticidade aqui pode precisar de revisão se as definições de pendente/atrasado mudaram muito seu significado
                criticality: stats.atrasadas * 2 + stats.pendentes 
            })).sort((a, b) => b.criticality - a.criticality);

        // Obtém todas as atividades do docente selecionado
        let activitiesForSelectedDocente = selectedDocente && docentesMap.has(selectedDocente) 
            ? docentesMap.get(selectedDocente)!.activities 
            : [];

        // Aplica o filtro de "pending", "late" ou "all" na lista de atividades do docente selecionado
        if (selectedDocente) {
            if (activityFilter === "pending") {
                activitiesForSelectedDocente = activitiesForSelectedDocente.filter(activity => activity.isPendente);
            } else if (activityFilter === "late") {
                activitiesForSelectedDocente = activitiesForSelectedDocente.filter(activity => activity.isAtrasado);
            } else if (activityFilter === "all") {
                // "All" agora significa Pendentes OU Atrasadas (entregues com atraso)
                activitiesForSelectedDocente = activitiesForSelectedDocente.filter(activity => activity.isPendente || activity.isAtrasado);
            }
        }

        return { 
            docentesData: docentesArray,
            selectedDocenteActivities: activitiesForSelectedDocente
        };
    }, [data, selectedDocente, activityFilter]); // Adicionado activityFilter às dependências

    const shortenName = (name: string) => {
        const parts = (name || "").trim().split(/\s+/);
        return parts.length > 2 ? `${parts[0]} ${parts[parts.length - 1]}` : name;
    }

    const getStatusBadge = (statusCalculado: string) => {
        // Aplicando o mesmo padrão de AccessTable.tsx para os badges de status
        if (statusCalculado.includes('Pendente')) {
            return <span className="status-badge bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300">{statusCalculado}</span>;
        }
        if (statusCalculado.includes('atraso')) {
            return <span className="status-badge bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">{statusCalculado.replace('Entregue com ', '')}</span>;
        }
        return <span className="text-slate-500 dark:text-gray-400">-</span>; // Para o caso de não haver status
    };

    const cardClasses = "bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm dark:shadow-md p-6";
    const titleClasses = "text-lg font-semibold text-slate-700 dark:text-white mb-4";
    const placeholderTextClasses = "text-center p-8 text-slate-600 dark:text-gray-400"; 

    const docenteButtonBase = "w-full p-3 rounded-lg text-left transition-colors";
    const docenteButtonNormal = "bg-gray-100 hover:bg-gray-200 border border-gray-200 dark:bg-slate-700/50 dark:hover:bg-slate-600/50 dark:border-slate-600";
    const docenteButtonSelected = "bg-cyan-500 text-white border border-cyan-500 dark:bg-[#2b466d] dark:text-white dark:border-cyan-400";
    
    const docenteNameClasses = "font-medium text-slate-700 dark:text-white"; // Mantido, mas verificar se o tema dark precisa de ajuste com nova cor de selected
    const badgeAtrasadasClasses = "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 px-2 py-1 rounded text-xs";
    const badgePendentesClasses = "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300 px-2 py-1 rounded text-xs";

    const activityItemClasses = "p-3 rounded-lg bg-gray-50 dark:bg-slate-700/40 border border-gray-200 dark:border-slate-600";
    const activityTitleClasses = "font-medium text-slate-700 dark:text-white mb-1";
    const activitySubtitleClasses = "text-sm text-slate-600 dark:text-gray-400 mb-2"; // Ajustado para text-slate-600
    const activityDateClasses = "text-sm text-slate-600 dark:text-gray-300";


    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Lista de Docentes */}
            <div className={cardClasses}>
                <h3 className={titleClasses}>Docentes com Atividades Pendentes/Atrasadas</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                    {docentesData.length === 0 ? (
                        <p className={placeholderTextClasses}>Nenhuma atividade pendente ou atrasada.</p>
                    ) : (
                        docentesData.map(({ docente, pendentes, atrasadas }) => (
                            <button
                                key={docente}
                                onClick={() => {
                                    onDocenteSelect(docente);
                                    setActivityFilter("all"); // Reset filter when selecting a new docente
                                }}
                                className={`${docenteButtonBase} ${
                                    selectedDocente === docente 
                                        ? docenteButtonSelected
                                        : docenteButtonNormal
                                }`}
                            >
                                <div className="flex justify-between items-center">
                                    <span className={docenteNameClasses}>{shortenName(docente)}</span>
                                    <div className="flex gap-2 text-sm">
                                        {atrasadas > 0 && (
                                            <span className={badgeAtrasadasClasses}>
                                                {atrasadas} atrasada{atrasadas > 1 ? 's' : ''}
                                            </span>
                                        )}
                                        {pendentes > 0 && (
                                            <span className={badgePendentesClasses}>
                                                {pendentes} pendente{pendentes > 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Detalhes do Docente Selecionado */}
            <div className={cardClasses}>
                <div className="flex justify-between items-center mb-4"> {/* Container para título e dropdown */}
                    <h3 className={titleClasses} style={{ marginBottom: 0 }}> {/* Removido mb-4 do título */}
                        {selectedDocente ? `Atividades de ${shortenName(selectedDocente)}` : 'Selecione um docente'}
                    </h3>
                    {selectedDocente && ( // Dropdown só aparece se um docente estiver selecionado
                        <select 
                            value={activityFilter} 
                            onChange={(e) => setActivityFilter(e.target.value as ActivityFilter)}
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-cyan-500 focus:border-cyan-500 block p-1.5 dark:bg-slate-700 dark:border-slate-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-cyan-500 dark:focus:border-cyan-500 ml-4" // Adicionado ml-4
                        >
                            <option value="all">Todas (Pend./Atr.)</option>
                            <option value="pending">Pendentes</option>
                            <option value="late">Atrasadas</option>
                        </select>
                    )}
                </div>
                <div className="max-h-[calc(24rem-3rem)] overflow-y-auto">  {/* Ajustar altura se necessário por causa do header com dropdown */}
                    {selectedDocenteActivities.length === 0 ? (
                        <p className={placeholderTextClasses}>
                            {selectedDocente 
                                ? (activityFilter === "pending" 
                                    ? "Nenhuma atividade pendente." 
                                    : activityFilter === "late" 
                                        ? "Nenhuma atividade entregue com atraso."
                                        : "Nenhuma atividade pendente ou entregue com atraso.")
                                : 'Clique em um docente para ver suas atividades.'}
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {selectedDocenteActivities.map((activity, index) => (
                                <div key={`${activity.Atividade}-${index}`} className={activityItemClasses}>
                                    <div className={activityTitleClasses}>{activity.Atividade}</div>
                                    <div className={activitySubtitleClasses}>{activity.Disciplina}</div>
                                    <div className="flex justify-between items-center">
                                        <span className={activityDateClasses}>
                                            Prazo: {activity['Data Limite Construção']}
                                        </span>
                                        {getStatusBadge(activity.statusCalculado)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
