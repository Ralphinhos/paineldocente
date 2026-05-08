import React, { useMemo, FC } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { ProcessedData, DocenteStats } from '../types';

interface PerformanceAnalysisProps {
    data: ProcessedData[];
    onAnalysis: (prompt: string, title: string) => void;
    selectedDocente: string | null;
}

export const PerformanceAnalysis: FC<PerformanceAnalysisProps> = ({ data, onAnalysis, selectedDocente }) => {
    const { topPerformers, bottomPerformers, selectedDocenteStats } = useMemo(() => {
        const ranking = data.reduce((acc, row) => {
            if (!acc[row.Docente]) acc[row.Docente] = { entregue: 0, atrasado: 0, pendente: 0, total: 0, diasSemAcesso: 0 };
            acc[row.Docente].total++;
            // Usar as flags do useDataProcessor que já refletem a lógica de "entregue com atraso" etc.
            if (row.isPendente) acc[row.Docente].pendente++;
            else if (row.isAtrasado) acc[row.Docente].atrasado++; // isAtrasado agora é "entregue com atraso"
            else if (row.isEntregueNoPrazo) acc[row.Docente].entregue++;
           
            const dias = parseInt(String(row['Dias s/ Acesso']), 10) || 0;
            if (dias > acc[row.Docente].diasSemAcesso) {
                acc[row.Docente].diasSemAcesso = dias;
            }
            return acc;
        }, {} as Record<string, any>);

        const comScore: DocenteStats[] = Object.entries(ranking).map(([docente, stats]) => ({
            docente,
            stats,
            score: stats.total > 0 ? (stats.entregue / stats.total) * 100 : 0,
            // A criticidade para ordenação dos 'bottomPerformers' pode continuar usando a lógica original
            // ou ser ajustada se a nova definição de 'atrasado' (apenas entregue com atraso) for preferida aqui também.
            // Por enquanto, mantém a lógica original de `atrasado * 2 + pendente` para ordenação.
            criticality: stats.atrasado * 2 + stats.pendente 
        }));

        const top = comScore.filter(d => d.score >= 60).sort((a, b) => b.score - a.score).slice(0, 5);
        const bottom = comScore.filter(d => d.score < 60).sort((a, b) => b.criticality - a.criticality).slice(0, 5);
        
        const selectedStats = selectedDocente ? comScore.find(d => d.docente === selectedDocente) : null;

        return { topPerformers: top, bottomPerformers: bottom, selectedDocenteStats: selectedStats };
    }, [data, selectedDocente]);

    const renderPerfCard = (docenteData: DocenteStats) => {
        const { docente, stats, score } = docenteData;
        const total = stats.total;
        const pEntregue = total > 0 ? (stats.entregue / total) * 100 : 0;
        const pAtrasado = total > 0 ? (stats.atrasado / total) * 100 : 0; // stats.atrasado é "entregue com atraso"
        const pPendente = total > 0 ? (stats.pendente / total) * 100 : 0;
        const shortenName = (name: string) => { 
            const parts = (name || "").trim().split(/\s+/); 
            return parts.length > 2 ? `${parts[0]} ${parts[parts.length - 1]}` : name; 
        };

        return (
            <div key={docente} className={innerCardClasses}>
                <div className="flex items-center justify-between">
                    <span className={perfCardDocenteName}>{shortenName(docente)}</span>
                    <span className={`font-bold ${score >= 80 ? 'text-green-400' : 'text-amber-400'}`}>
                        {score.toFixed(0)}% no Prazo
                    </span>
                </div>
                <div className={`w-full ${perfCardProgressBarBg} rounded-full h-2.5 mt-2 flex`}>
                    <div className="bg-green-500 h-2.5 rounded-l-full" style={{ width: `${pEntregue}%` }}></div>
                    <div className="bg-amber-500 h-2.5" style={{ width: `${pAtrasado}%` }}></div>
                    <div className="bg-red-500 h-2.5 rounded-r-full" style={{ width: `${pPendente}%` }}></div>
                </div>
            </div>
        );
    };

    const renderPieChart = (docenteData: DocenteStats) => {
        const { stats, score } = docenteData; // Adicionado score aqui
        const chartData = [
            // Usar stats.entregue (que é efetivamente entregue no prazo), stats.atrasado (entregue com atraso), stats.pendente
            { name: 'Entregue no Prazo', value: stats.entregue, color: '#22c55e' },
            { name: 'Entregue c/ Atraso', value: stats.atrasado, color: '#f59e0b' },
            { name: 'Pendente', value: stats.pendente, color: '#ef4444' }
        ].filter(item => item.value > 0);

        const shortenName = (name: string) => {
            const parts = (name || "").trim().split(/\s+/);
            return parts.length > 2 ? `${parts[0]} ${parts[parts.length - 1]}` : name;
        };

        const CustomTooltip = ({ active, payload }: any) => {
            if (active && payload && payload.length) {
                const data = payload[0];
                return (
                    <div className={tooltipClasses}>
                        <p>{`${data.name}: ${data.value}`}</p>
                    </div>
                );
            }
            return null;
        };

        return (
            <div className={pieChartCardClasses}>
                <div className="text-center mb-3">
                    <h4 className={pieChartTitle}>{shortenName(docenteData.docente)}</h4>
                    <p className={pieChartSubtitle}>Total: {stats.total} atividades</p>
                </div>
                <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={30}
                                outerRadius={70}
                                paddingAngle={2}
                                dataKey="value"
                            >
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="mt-3 space-y-1">
                    {chartData.map(item => (
                        <div key={item.name} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                                <div 
                                    className="w-3 h-3 rounded-full" 
                                    style={{ backgroundColor: item.color }}
                                ></div>
                                <span className={pieLegendText}>{item.name}</span>
                            </div>
                            <span className={pieLegendValue}>{item.value}</span>
                        </div>
                    ))}
                </div>
                {/* Adicionando Taxa de Entrega abaixo da legenda */}
                <div className="mt-4 pt-3 border-t border-gray-200 dark:border-slate-600 text-center">
                    <span className={`${detailLabel} mr-2`}>Taxa de Entrega (no prazo):</span>
                    <span className={`font-bold text-lg ${score >= 80 ? 'text-green-500' : score >= 60 ? 'text-amber-500' : 'text-red-500'}`}>
                        {score.toFixed(1)}%
                    </span>
                </div>
            </div>
        );
    };

    // --- Classes de Estilo ---
    const themedCardClasses = "bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 flex flex-col p-6 rounded-lg shadow-sm dark:shadow-md";
    const titleClasses = "text-lg font-semibold text-slate-700 dark:text-white mb-4";
    const placeholderTextClasses = "text-slate-600 dark:text-gray-400 text-center py-10";
    const innerCardClasses = "p-3 rounded-lg bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600";
    const pieChartCardClasses = "p-4 rounded-lg bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600";
    // statsDetailCardClasses não é mais usado
    const tooltipClasses = "bg-white text-slate-700 border border-gray-300 dark:bg-slate-800 dark:text-white dark:border-slate-600 p-2 rounded shadow-lg text-sm";
    const perfCardDocenteName = "font-bold text-slate-700 dark:text-white";
    const perfCardProgressBarBg = "bg-gray-200 dark:bg-slate-700";
    const pieChartTitle = "font-bold text-slate-700 dark:text-white";
    const pieChartSubtitle = "text-sm text-slate-600 dark:text-gray-400";
    const pieLegendText = "text-slate-600 dark:text-gray-300";
    const pieLegendValue = "text-slate-700 dark:text-white font-medium";
    const detailLabel = "text-slate-600 dark:text-gray-400";


    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className={themedCardClasses}>
                <h3 className={titleClasses}>Top 5 - Análise de Performance</h3>
                <div className="flex-grow overflow-y-auto space-y-4">
                    {topPerformers.length > 0 ? (
                        topPerformers.map(renderPerfCard)
                    ) : (
                        <p className={placeholderTextClasses}>Nenhum docente com performance {'>='} 60%.</p>
                    )}
                </div>
            </div>

            <div className={themedCardClasses}>
                <h3 className={titleClasses}>
                    {selectedDocente ? `Detalhes: ${selectedDocente.split(' ')[0]} ${selectedDocente.split(' ').slice(-1)[0]}` : 'Top 5 - Pontos de Atenção'}
                </h3>
                <div className="flex-grow overflow-y-auto space-y-4">
                    {selectedDocenteStats ? (
                        // O card de Estatísticas Detalhadas foi removido.
                        // O gráfico de pizza (que agora inclui a taxa de entrega) será renderizado diretamente.
                        renderPieChart(selectedDocenteStats)
                    ) : bottomPerformers.length > 0 ? (
                        bottomPerformers.map(renderPerfCard)
                    ) : (
                        <p className={placeholderTextClasses}>Nenhum docente com performance {'<'} 60%.</p>
                    )}
                </div>
            </div>
        </div>
    );
};