import React, { useMemo, useState, FC } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { ProcessedData } from '../types';

interface AccessTableProps { data: ProcessedData[]; }
interface SortConfig { key: keyof ProcessedData | 'Dias s/ Acesso'; direction: 'asc' | 'desc'; }

const AccessTable: FC<AccessTableProps> = ({ data }) => {
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'Dias s/ Acesso', direction: 'desc' });
    
    const allAccessData = useMemo(() => {
        const accessMap = new Map<string, ProcessedData>();
        data.forEach(row => {
            const key = `${row.Docente}-${row.Disciplina}`;
            const diasRaw = row['Dias s/ Acesso'];
            const dias = diasRaw === null ? Infinity : Number(diasRaw); 
            const existingEntry = accessMap.get(key);
            const existingDiasRaw = existingEntry ? existingEntry['Dias s/ Acesso'] : 0;
            const existingDias = existingDiasRaw === null ? Infinity : Number(existingDiasRaw);

            if (!existingEntry || dias > existingDias) {
                accessMap.set(key, row);
            }
        });
        return Array.from(accessMap.values());
    }, [data]);

    const sortedAccessData = useMemo(() => {
        if (!sortConfig) return allAccessData;

        return [...allAccessData].sort((a, b) => {
            const aValue = a[sortConfig.key as keyof ProcessedData];
            const bValue = b[sortConfig.key as keyof ProcessedData];

            if (sortConfig.key === 'Dias s/ Acesso') {
                // Trata Null como Infinito (Nunca Acessou)
                const numA = aValue === null ? Infinity : Number(aValue);
                const numB = bValue === null ? Infinity : Number(bValue);
                return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
            }

            if (typeof aValue === 'string' && typeof bValue === 'string') {
                const comparison = aValue.localeCompare(bValue, undefined, { numeric: true, sensitivity: 'base' });
                return sortConfig.direction === 'asc' ? comparison : -comparison;
            }
            return 0; 
        });
    }, [allAccessData, sortConfig]);
   
    const getStatusBadge = (diasNum: number | null) => { 
        if (diasNum === null) return <span className="status-badge bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300">Nunca Acessou</span>;
        if (diasNum > 10) return <span className="status-badge bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300">Crítico</span>;
        if (diasNum >= 7) return <span className="status-badge bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">Atenção</span>;
        return <span className="status-badge bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300">Em Dia</span>;
    };
   
    const shortenName = (name: string) => {
        const parts = (name || "").trim().split(/\s+/);
        return parts.length > 2 ? `${parts[0]} ${parts[parts.length - 1]}` : name;
    }

    const requestSort = (key: SortConfig['key']) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const thClasses = "p-3 text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider text-left";
    const tdClasses = "p-3 text-slate-700 dark:text-gray-300";

    return (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-700 dark:text-white mb-4">Status de Acesso</h3>
            <div className="table-container overflow-y-auto">
                <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-slate-200 dark:bg-slate-700 border-b border-gray-300 dark:border-slate-600 z-10">
                        <tr>
                            <th className={thClasses}>
                                <button onClick={() => requestSort('Docente')} className="flex items-center gap-1 w-full hover:text-cyan-600 dark:hover:text-cyan-400">
                                    Docente {sortConfig?.key === 'Docente' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                                </button>
                            </th>
                            <th className={thClasses}>
                                <button onClick={() => requestSort('Curso')} className="flex items-center gap-1 w-full hover:text-cyan-600 dark:hover:text-cyan-400">
                                    Curso {sortConfig?.key === 'Curso' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                                </button>
                            </th>
                            <th className={thClasses}>
                                <button onClick={() => requestSort('Disciplina')} className="flex items-center gap-1 w-full hover:text-cyan-600 dark:hover:text-cyan-400">
                                    Disciplina {sortConfig?.key === 'Disciplina' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                                </button>
                            </th>
                            <th className={`${thClasses} text-center`}>
                                <button onClick={() => requestSort('Dias s/ Acesso')} className="flex items-center justify-center gap-1 w-full hover:text-cyan-600 dark:hover:text-cyan-400">
                                    Dias s/ Acesso {sortConfig?.key === 'Dias s/ Acesso' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                                </button>
                            </th>
                            <th className={`${thClasses} text-center`}>
                                <button onClick={() => requestSort('Dias s/ Acesso')} className="flex items-center justify-center gap-1 w-full hover:text-cyan-600 dark:hover:text-cyan-400">
                                    Status {sortConfig?.key === 'Dias s/ Acesso' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                                </button>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                        {sortedAccessData.length === 0 ? (
                            <tr><td colSpan={5} className="text-center p-8 text-slate-600 dark:text-gray-400">Nenhum docente encontrado.</td></tr>
                        ) : (
                            sortedAccessData.map(row => (
                                <tr key={`${row.Docente}-${row.Disciplina}`} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                                    <td className={tdClasses}>{shortenName(row.Docente)}</td>
                                    <td className={tdClasses}>{row.Curso}</td>
                                    <td className={tdClasses}>{row.Disciplina}</td>
                                    <td className={`${tdClasses} text-center`}>{row['Dias s/ Acesso'] === null ? '--' : row['Dias s/ Acesso']}</td>
                                    <td className={`${tdClasses} text-center`}>{getStatusBadge(row['Dias s/ Acesso'] as number | null)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AccessTable;