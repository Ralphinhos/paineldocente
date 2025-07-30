
import React, { useMemo, useState, FC } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { ProcessedData } from '../types';

interface AccessTableProps {
  data: ProcessedData[];
}

// Definindo a interface para a configuração de classificação
interface SortConfig {
  key: keyof ProcessedData | 'Dias s/ Acesso'; // Inclui chaves de ProcessedData e especificamente 'Dias s/ Acesso'
  direction: 'asc' | 'desc';
}

export const AccessTable: FC<AccessTableProps> = ({ data }) => {
    // Substituindo sortOrder por sortConfig
    // A coluna 'Dias s/ Acesso' (que alimenta o Status) é a padrão inicial para ordenação
    const [sortConfig, setSortConfig] = useState<SortConfig>({ 
        key: 'Dias s/ Acesso', 
        direction: 'desc' // desc = crítico (maior número de dias) primeiro
    });
    
    const allAccessData = useMemo(() => {
        const accessMap = new Map<string, ProcessedData>();
        data.forEach(row => {
            const key = `${row.Docente}-${row.Disciplina}`;
            // 'Dias s/ Acesso' já é number a partir de ProcessedData
            const dias = Number(row['Dias s/ Acesso']) || 0; 
            const existingEntry = accessMap.get(key);
            const existingDias = existingEntry ? (Number(existingEntry['Dias s/ Acesso']) || 0) : -1;

            if (!existingEntry || dias > existingDias) {
                accessMap.set(key, row);
            }
        });
        return Array.from(accessMap.values());
    }, [data]);

    const sortedAccessData = useMemo(() => {
        if (!sortConfig) return allAccessData; // Retorna dados não ordenados se não houver configuração

        return [...allAccessData].sort((a, b) => {
            // Acessa os valores com base na chave de ordenação
            // É importante garantir que sortConfig.key seja uma chave válida de ProcessedData
            // ou 'Dias s/ Acesso' que também deve estar em ProcessedData ou ser tratado especialmente.
            const aValue = a[sortConfig.key as keyof ProcessedData];
            const bValue = b[sortConfig.key as keyof ProcessedData];

            // Tratamento para números (como 'Dias s/ Acesso')
            if (typeof aValue === 'number' && typeof bValue === 'number') {
                return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
            }
            // Tratamento para strings (Docente, Curso, Disciplina)
            // Usar localeCompare para ordenação correta de strings, incluindo acentos.
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                const comparison = aValue.localeCompare(bValue, undefined, { numeric: true, sensitivity: 'base' });
                return sortConfig.direction === 'asc' ? comparison : -comparison;
            }
            // Fallback se os tipos não forem comparáveis ou forem mistos (não ideal)
            return 0; 
        });
    }, [allAccessData, sortConfig]);
   
    const getStatusBadge = (diasNum: number) => { // Parâmetro agora é number
        const dias = diasNum; // Já é número
        if (dias > 10) return <span className="status-badge bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300">Crítico</span>;
        if (dias >= 7) return <span className="status-badge bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">Atenção</span>;
        return <span className="status-badge bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300">Em Dia</span>;
    };
   
    const shortenName = (name: string) => {
        const parts = (name || "").trim().split(/\s+/);
        return parts.length > 2 ? `${parts[0]} ${parts[parts.length - 1]}` : name;
    }

    // Função para lidar com a solicitação de classificação
    const requestSort = (key: SortConfig['key']) => {
        let direction: 'asc' | 'desc' = 'asc';
        // Se a mesma coluna for clicada e já estiver em ordem ascendente, muda para descendente
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        // Caso contrário, (nova coluna ou mesma coluna já em desc) define para ascendente
        // ou se for uma nova coluna, começa com ascendente.
        setSortConfig({ key, direction });
    };

    // Removido toggleSort, pois requestSort cobre sua funcionalidade no contexto do novo sistema.

    const cardClasses = "bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm dark:shadow-md p-6";
    const thClasses = "p-3 text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider text-left"; // Ajustado para text-gray-600
    const tdClasses = "p-3 text-slate-700 dark:text-gray-300";
    const trHoverClasses = "hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors";
    const placeholderTextClasses = "text-center p-8 text-slate-600 dark:text-gray-400"; // Definido para placeholder

    return (
        <div className={cardClasses}>
            <h3 className="text-lg font-semibold text-slate-700 dark:text-white mb-4">Status de Acesso</h3>
            <div className="table-container overflow-y-auto">
                <table className="w-full text-left text-sm">
                    {/* Aplicando fundo mais escuro ao thead */}
                    <thead className="sticky top-0 bg-slate-200 dark:bg-slate-700 border-b border-gray-300 dark:border-slate-600 z-10">
                        <tr>
                            <th className={thClasses}>
                                <button 
                                    onClick={() => requestSort('Docente')}
                                    className="flex items-center gap-1 w-full hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                                >
                                    Docente
                                    {sortConfig?.key === 'Docente' && (
                                        sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                                    )}
                                </button>
                            </th>
                            <th className={thClasses}>
                                <button 
                                    onClick={() => requestSort('Curso')}
                                    className="flex items-center gap-1 w-full hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                                >
                                    Curso
                                    {sortConfig?.key === 'Curso' && (
                                        sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                                    )}
                                </button>
                            </th>
                            <th className={thClasses}>
                                <button 
                                    onClick={() => requestSort('Disciplina')}
                                    className="flex items-center gap-1 w-full hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                                >
                                    Disciplina
                                    {sortConfig?.key === 'Disciplina' && (
                                        sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                                    )}
                                </button>
                            </th>
                            <th className={`${thClasses} text-center`}>
                                <button 
                                    onClick={() => requestSort('Dias s/ Acesso')} // Chave correspondente aos dados
                                    className="flex items-center justify-center gap-1 w-full hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                                >
                                    Dias s/ Acesso
                                    {sortConfig?.key === 'Dias s/ Acesso' && (
                                        sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                                    )}
                                </button>
                            </th>
                            <th className={`${thClasses} text-center`}>
                                <button 
                                    onClick={() => requestSort('Dias s/ Acesso')} // Status é ordenado por 'Dias s/ Acesso'
                                    className="flex items-center justify-center gap-1 w-full hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                                >
                                    Status
                                    {sortConfig?.key === 'Dias s/ Acesso' && ( // O ícone de Status acompanha 'Dias s/ Acesso'
                                        sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                                    )}
                                </button>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                        {sortedAccessData.length === 0 ? (
                            <tr>
                                <td colSpan={5} className={placeholderTextClasses}>
                                    Nenhum docente encontrado.
                                </td>
                            </tr>
                        ) : (
                            sortedAccessData.map(row => (
                                <tr key={`${row.Docente}-${row.Disciplina}`} className={trHoverClasses}>
                                    <td className={tdClasses}>{shortenName(row.Docente)}</td>
                                    <td className={tdClasses}>{row.Curso}</td>
                                    <td className={tdClasses}>{row.Disciplina}</td>
                                    {/* 'Dias s/ Acesso' é number, será convertido para string automaticamente na renderização */}
                                    <td className={`${tdClasses} text-center`}>{row['Dias s/ Acesso']}</td>
                                    {/* Passando o número diretamente para getStatusBadge */}
                                    <td className={`${tdClasses} text-center`}>{getStatusBadge(Number(row['Dias s/ Acesso']) || 0)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
