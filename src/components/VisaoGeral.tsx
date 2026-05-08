// src/components/VisaoGeral.tsx

import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, LabelList } from 'recharts';
import { ProcessedData } from '../types';
import { useTheme } from '../contexts/ThemeContext'; // Importar useTheme

interface VisaoGeralProps {
    data: ProcessedData[];
}

// ALTERAÇÃO 3: Rótulo agora exibe TODOS os valores maiores que 0, sem verificar o tamanho da barra.
const renderSmartLabel = (props: any) => { // Adaptação de cor de label não é necessária aqui se as cores das barras são fixas e contrastantes
    const { x, y, width, height, value, fill } = props;
    
    if (value > 0) { 
        // A cor do label é definida baseada no preenchimento da barra para melhor contraste.
        // Se a barra for âmbar, o texto é preto, senão branco. Isso deve funcionar bem em ambos os temas.
        const labelFill = (fill === '#f59e0b') ? '#000000' : '#ffffff'; 
        return (
            <text x={x + width / 2} y={y + height / 2} fill={labelFill} textAnchor="middle" dominantBaseline="middle" fontSize={12} fontWeight="bold">
                {value}
            </text>
        );
    }
    return null;
};

export const VisaoGeral: React.FC<VisaoGeralProps> = ({ data }) => {

    const dadosDoGrafico = useMemo(() => {
        if (!data || data.length === 0) return [];
        const dadosAgregados = data.reduce((acc, item) => {
            const curso = item.Curso || 'Não especificado';
            if (!acc[curso]) {
                acc[curso] = { curso: curso, entregues: 0, pendentes: 0, atrasadas: 0 };
            }
            if (item.isEntregueNoPrazo) acc[curso].entregues++;
            else if (item.isPendente) acc[curso].pendentes++;
            else if (item.isAtrasado) acc[curso].atrasadas++;
            return acc;
        }, {} as Record<string, { curso: string; entregues: number; pendentes: number; atrasadas: number;}>);
        
        // Ordenar por 'entregues' em ordem decrescente
        const sortedData = Object.values(dadosAgregados).sort((a, b) => b.entregues - a.entregues);
        return sortedData;
    }, [data]);

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white dark:bg-slate-800 p-3 rounded border border-gray-300 dark:border-slate-600 shadow-lg text-sm">
                    <p className="font-bold text-slate-700 dark:text-white mb-2">{label}</p>
                    {payload.slice().reverse().map((entry: any) => (
                        <p key={entry.dataKey} style={{ color: entry.color }} className="text-slate-600 dark:text-gray-300">
                            {`${entry.name}: ${entry.value}`}
                        </p>
                    ))}
                    <p className="mt-2 pt-2 border-t border-gray-300 dark:border-slate-500 text-slate-500 dark:text-gray-300">
                        Total: {payload.reduce((sum: number, entry: any) => sum + entry.value, 0)} atividades
                    </p>
                </div>
            );
        }
        return null;
    };

    const { theme } = useTheme(); // Obter o tema atual

    const cardClasses = "bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm dark:shadow-md p-6 mt-4";
    const titleClasses = "text-lg font-semibold text-slate-700 dark:text-white mb-4";
    const placeholderTextClasses = "text-slate-600 dark:text-gray-400 text-center py-10"; // Ajustado
    
    const xAxisTickFill = theme === 'dark' ? '#d1d5db' : '#4b5563';
    const yAxisStroke = theme === 'dark' ? '#9ca3af' : '#6b7280';
    const cartesianGridStroke = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)';
    const tooltipCursorFill = theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)';
    const legendWrapperStyle = { 
        top: -10, 
        color: theme === 'dark' ? '#e2e8f0' : '#334155' // slate-200 e slate-700
    };


    return (
        <div className={cardClasses}>
            <h3 className={titleClasses}>
                Desempenho por Curso
            </h3>
            
            {dadosDoGrafico.length > 0 ? (
                <div style={{ width: '100%', height: '600px' }}> 
                    <ResponsiveContainer>
                        <BarChart
                            data={dadosDoGrafico}
                            margin={{ top: 20, right: 30, left: 20, bottom: 150 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke={cartesianGridStroke} />
                            
                            <XAxis 
                                dataKey="curso" 
                                type="category"
                                interval={0}
                                angle={-45}
                                textAnchor="end"
                                tick={{ fontSize: 12, fill: xAxisTickFill }}
                            />
                            
                            <YAxis 
                                type="number"
                                stroke={yAxisStroke}
                                tick={{ fontSize: 12 }}
                                hide={true} 
                            />
                            
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: tooltipCursorFill }}/>
                            
                            <Legend 
                                verticalAlign="top" 
                                align="right" 
                                wrapperStyle={legendWrapperStyle} 
                            />

                            <Bar dataKey="entregues" name="Entregues no Prazo" stackId="a" fill="#22c55e">
                                <LabelList dataKey="entregues" content={renderSmartLabel} />
                            </Bar>

                            <Bar dataKey="atrasadas" name="Entregue com Atraso" stackId="a" fill="#f59e0b">
                                <LabelList dataKey="atrasadas" content={renderSmartLabel} />
                            </Bar>
                            
                            <Bar dataKey="pendentes" name="Pendentes" stackId="a" fill="#ef4444">
                                <LabelList dataKey="pendentes" content={renderSmartLabel} />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <p className={placeholderTextClasses}>
                    Selecione filtros de Semestre e Modalidade para visualizar os dados.
                </p>
            )}
        </div>
    );
};