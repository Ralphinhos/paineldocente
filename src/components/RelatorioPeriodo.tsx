import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataContext } from '../contexts/DataContext';
import { ProcessedData, DocentePerformance, IKpisPeriodo, CursoPerformance } from '../types';
import { LoadingScreen } from './LoadingScreen';
import useIdleTimer from '../hooks/useIdleTimer';
import { KpiCard } from './ui/KpiCard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, Cell } from 'recharts';
import { DetalhamentoPendentesModal } from './modals/DetalhamentoPendentesModal'; 
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const COR_GRAFICO_POSITIVO = "#22c55e"; 
const COR_GRAFICO_NEGATIVO = "#ef4444"; 

const shortenName = (name: string): string => {
    if (typeof name !== 'string' || !name.trim()) return 'N/D';
    const parts = name.trim().split(/\s+/);
    return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : name;
};

// Componente Reutilizável para os Gráficos de Barra (Limpa muito o código!)
const ChartModule = ({ data, title, dataKeyX, dataKeyY, isPositive, color, isPercent }: any) => {
    if (!data || data.length === 0) {
        return (
            <div className="p-4 bg-white dark:bg-slate-800 rounded-lg shadow min-h-[300px]">
                <h4 className="text-lg font-semibold text-slate-700 dark:text-white mb-3">{title}</h4>
                <p className="text-sm text-slate-500 dark:text-gray-400">Não há dados suficientes...</p>
            </div>
        );
    }
    
    return (
        <div className="p-4 bg-white dark:bg-slate-800 rounded-lg shadow min-h-[300px]">
            <h4 className="text-lg font-semibold text-slate-700 dark:text-white mb-3">{title}</h4>
            <ResponsiveContainer width="100%" height={350}>
                <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 70 }}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                    <XAxis type="category" dataKey={dataKeyX} tick={{ fontSize: 9, fill: '#64748b' }} interval={0} angle={-30} textAnchor="end" height={60} />
                    <YAxis type="number" width={0} tick={false} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '8px', color: '#1e293b' }} />
                    <Bar dataKey={dataKeyY} fill={color} radius={[4, 4, 0, 0]}>
                        <LabelList 
                            dataKey={dataKeyY} 
                            position="top" 
                            style={{ fill: color, fontSize: 11, fontWeight: 'bold' }} 
                            formatter={(val: number) => isPercent ? `${val.toFixed(1)}%` : val}
                        />
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export const RelatorioPeriodo: React.FC = () => {
    const navigate = useNavigate();
    const { allData, isLoading, error: dataError, historyList, selectedHistory, setSelectedHistory } = useDataContext();

    const handleRelatorioIdleLogout = useCallback(() => navigate('/login'), [navigate]);
    useIdleTimer(10 * 60 * 1000, handleRelatorioIdleLogout);

    useEffect(() => {
        if (localStorage.getItem('userRole') !== 'admin') navigate('/'); 
    }, [navigate]);

    const [anoSelecionado, setAnoSelecionado] = useState<string>(new Date().getFullYear().toString());
    const [semestreFiltro, setSemestreFiltro] = useState<string>('0');
    const [modalidadeSelecionada, setModalidadeSelecionada] = useState<string>('Todas');
    const [relatorioGerado, setRelatorioGerado] = useState<ProcessedData[] | null>(null);
    const [kpisPeriodo, setKpisPeriodo] = useState<IKpisPeriodo | null>(null);
    const [isPendentesModalOpen, setIsPendentesModalOpen] = useState(false);
    const [dadosPendentesParaModal, setDadosPendentesParaModal] = useState<ProcessedData[]>([]);

    const [topDocentesMelhor, setTopDocentesMelhor] = useState<any[]>([]);
    const [topDocentesAtencao, setTopDocentesAtencao] = useState<any[]>([]);
    const [topCursosMelhor, setTopCursosMelhor] = useState<any[]>([]);
    const [topCursosAtencao, setTopCursosAtencao] = useState<any[]>([]);
    const [topFrequencia, setTopFrequencia] = useState<any[]>([]);
    const [bottomFrequencia, setBottomFrequencia] = useState<any[]>([]);

    const reportRef = useRef<HTMLDivElement>(null);

    const modalidadesUnicas = useMemo(() => [...new Set(allData.map(i => i.Modalidade).filter(Boolean).sort())] as string[], [allData]);

    const handleAbrirModalPendentes = () => {
        setDadosPendentesParaModal(relatorioGerado ? relatorioGerado.filter(item => item.isPendente) : []);
        setIsPendentesModalOpen(true);
    };

    const handleExportarPDF = async () => {
        if (!reportRef.current) return;
        try {
            const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#f3f4f6' });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgHeight = (canvas.height * pdfWidth) / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;
            while (heightLeft > 0) {
                position = heightLeft - imgHeight; 
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                heightLeft -= pdfHeight;
            }
            pdf.save(`relatorio-visao-geral-${selectedHistory}.pdf`);
        } catch (error) { alert("Não foi possível exportar o relatório para PDF."); }
    };

    const handleGerarRelatorio = () => {
        if (!anoSelecionado) return alert("Por favor, informe o Ano.");
        const dadosFiltrados = allData.filter(item => {
            const modMatch = modalidadeSelecionada === 'Todas' || item.Modalidade === modalidadeSelecionada;
            const semMatch = semestreFiltro === '0' ? item.Semestre?.startsWith(`${anoSelecionado}_`) : item.Semestre === `${anoSelecionado}_${semestreFiltro}`;
            return modMatch && semMatch;
        });

        setRelatorioGerado(dadosFiltrados);
        if (dadosFiltrados.length > 0) {
            
            // 1. KPIs
            let tENP = 0, tECA = 0, tP = 0, sDA = 0, cAATMPM = 0;
            dadosFiltrados.forEach(i => { 
                if (i.isEntregueNoPrazo) tENP++; if (i.isAtrasado && !i.isPendente) tECA++; if (i.isPendente) tP++;
                if (i.isAtrasado && !i.isPendente && i.diasCalculado && i.diasCalculado > 0) { sDA += i.diasCalculado; cAATMPM++; }
            });
            const tAC = dadosFiltrados.length;
            setKpisPeriodo({
                totalAtividadesConsideradas: tAC, totalEntreguesNoPrazo: tENP, totalEntreguesComAtraso: tECA, totalPendentes: tP,
                porcentagemEntreguesNoPrazo: tAC ? (tENP / tAC) * 100 : 0, porcentagemComAtraso: tAC ? (tECA / tAC) * 100 : 0,
                porcentagemPendentes: tAC ? (tP / tAC) * 100 : 0, mediaDiasAtraso: cAATMPM ? Math.round(sDA / cAATMPM) : 0,
            });

            // 2. Perf Docentes
            const docMap = new Map();
            dadosFiltrados.forEach(i => {
                if (!i.Docente) return;
                const s = docMap.get(i.Docente) || { total: 0, atraso: 0, prazo: 0 };
                s.total++; if (i.isAtrasado) s.atraso++; if (i.isEntregueNoPrazo) s.prazo++;
                docMap.set(i.Docente, s);
            });
            const perfDocentes = Array.from(docMap.entries()).map(([n, s]) => ({
                nomeAbreviado: shortenName(n), pctPrazo: (s.prazo/s.total)*100, totAtraso: s.atraso, total: s.total 
            }));
            setTopDocentesMelhor([...perfDocentes].sort((a,b) => b.pctPrazo - a.pctPrazo || b.total - a.total).slice(0,5));
            setTopDocentesAtencao([...perfDocentes].sort((a,b) => (b.totAtraso/b.total) - (a.totAtraso/a.total) || b.total - a.total).slice(0,5));

            // 3. Perf Cursos
            const curMap = new Map();
            dadosFiltrados.forEach(i => {
                if (!i.Curso) return;
                const s = curMap.get(i.Curso) || { total: 0, atraso: 0, prazo: 0 };
                s.total++; if (i.isAtrasado) s.atraso++; if (i.isEntregueNoPrazo) s.prazo++;
                curMap.set(i.Curso, s);
            });
            const perfCursos = Array.from(curMap.entries()).map(([n, s]) => ({
                nomeCurso: n, pctPrazo: (s.prazo/s.total)*100, totAtraso: s.atraso, total: s.total 
            }));
            setTopCursosMelhor([...perfCursos].sort((a,b) => b.pctPrazo - a.pctPrazo || b.total - a.total).slice(0,5));
            setTopCursosAtencao([...perfCursos].sort((a,b) => (b.totAtraso/b.total) - (a.totAtraso/a.total) || b.total - a.total).slice(0,5));

            // 4. Frequência Acesso
            const acMap = new Map();
            dadosFiltrados.forEach(i => {
                if (!i.Docente) return;
                const dias = i['Dias s/ Acesso'];
                if (typeof dias === 'number') {
                    const s = acMap.get(i.Docente) || { tot: 0, cnt: 0 };
                    s.tot += dias; s.cnt++; acMap.set(i.Docente, s);
                }
            });
            const acessoDoc = Array.from(acMap.entries()).map(([n, s]) => ({
                nomeAbreviado: shortenName(n), mediaAcesso: Math.round(s.tot/s.cnt)
            }));
            setTopFrequencia([...acessoDoc].sort((a, b) => a.mediaAcesso - b.mediaAcesso).slice(0, 5));
            setBottomFrequencia([...acessoDoc].sort((a, b) => b.mediaAcesso - a.mediaAcesso).slice(0, 5));

        } else {
            setTopDocentesMelhor([]); setTopDocentesAtencao([]); setTopCursosMelhor([]); setTopCursosAtencao([]); setTopFrequencia([]); setBottomFrequencia([]); setKpisPeriodo(null);
        }
    };

    if (isLoading) return <LoadingScreen message="Carregando dados para o relatório..." />;
    if (dataError) return <div className="p-4 text-red-700 bg-red-100 rounded-md">Erro: {dataError}</div>;

    return (
        <div ref={reportRef} className="p-6 lg:p-8 space-y-6 bg-gray-100 dark:bg-[#0f172a] text-slate-800 dark:text-gray-200 min-h-screen">
            <header className="space-y-2 mb-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Visão Geral</h2>
                    <div className="flex gap-2" data-html2canvas-ignore="true">
                        <button onClick={handleExportarPDF} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors">Exportar PDF</button>
                        <button onClick={() => navigate('/')} className="px-4 py-2 text-sm font-medium text-cyan-700 bg-cyan-100 rounded-md hover:bg-cyan-200 transition-colors">&larr; Voltar</button>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end p-4 bg-white dark:bg-slate-800 rounded-lg shadow" data-html2canvas-ignore="true">
                <div>
                    <label className="block text-sm font-medium mb-1">Dados Base:</label>
                    <select value={selectedHistory} onChange={(e) => setSelectedHistory(e.target.value)} className="block w-full px-3 py-1.5 text-sm rounded-md shadow-sm border border-gray-300 dark:bg-slate-700">
                        <option value="current">Atuais (Planilha)</option>
                        {historyList && historyList.map((h: any) => <option key={h.id} value={h.id}>{h.label}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Ano:</label>
                    <input type="number" value={anoSelecionado} onChange={(e) => setAnoSelecionado(e.target.value)} className="block w-full px-3 py-1.5 text-sm rounded-md shadow-sm border border-gray-300 dark:bg-slate-700" />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Semestre:</label>
                    <select value={semestreFiltro} onChange={(e) => setSemestreFiltro(e.target.value)} className="block w-full px-3 py-1.5 text-sm rounded-md shadow-sm border border-gray-300 dark:bg-slate-700">
                        <option value="0">Ambos os Semestres</option><option value="1">1º Semestre</option><option value="2">2º Semestre</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Modalidade:</label>
                    <select value={modalidadeSelecionada} onChange={(e) => setModalidadeSelecionada(e.target.value)} className="block w-full px-3 py-1.5 text-sm rounded-md shadow-sm border border-gray-300 dark:bg-slate-700">
                        <option value="Todas">Todas as Modalidades</option>
                        {modalidadesUnicas.map(mod => <option key={mod} value={mod}>{mod}</option>)}
                    </select>
                </div>
                <button onClick={handleGerarRelatorio} className="w-full md:w-auto px-4 py-2 text-sm font-semibold text-white bg-cyan-600 rounded-md hover:bg-cyan-700">Gerar Relatório</button>
            </div>

            <div className="bg-gray-100 dark:bg-[#0f172a] pb-6 rounded-lg pt-6 px-4 -mx-4 mt-2">
                {kpisPeriodo && (
                <div className="p-4 bg-slate-100 dark:bg-slate-900 rounded-lg shadow">
                    <h3 className="text-xl font-semibold mb-4">Resumo Geral do Semestre</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <KpiCard titulo="Total de Atividades" valor={kpisPeriodo.totalAtividadesConsideradas} />
                        <KpiCard titulo="% Entregues no Prazo" valor={kpisPeriodo.porcentagemEntreguesNoPrazo.toFixed(1)} unidade="%" corValor="text-green-500" descricao={`${kpisPeriodo.totalEntreguesNoPrazo} atividades`} />
                        <KpiCard titulo="% Com Atraso" valor={kpisPeriodo.porcentagemComAtraso.toFixed(1)} unidade="%" corValor="text-red-500" descricao={`${kpisPeriodo.totalEntreguesComAtraso} atividades`} />
                        <div onClick={handleAbrirModalPendentes} className="cursor-pointer hover:opacity-80 transition-opacity">
                            <KpiCard titulo="% Pendentes" valor={kpisPeriodo.porcentagemPendentes.toFixed(1)} unidade="%" corValor="text-amber-500" descricao="Clique para ver" />
                        </div>
                    </div>
                </div>
                )}

                {relatorioGerado && relatorioGerado.length > 0 && (
                    <>
                        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <ChartModule data={topDocentesMelhor} title="Top 5 Docentes (Melhor % Prazo)" dataKeyX="nomeAbreviado" dataKeyY="pctPrazo" color={COR_GRAFICO_POSITIVO} isPercent={true} />
                            <ChartModule data={topDocentesAtencao} title="Top 5 Docentes (Mais Atrasos)" dataKeyX="nomeAbreviado" dataKeyY="totAtraso" color={COR_GRAFICO_NEGATIVO} isPercent={false} />
                        </div>
                        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <ChartModule data={topCursosMelhor} title="Top 5 Cursos (Melhor % Prazo)" dataKeyX="nomeCurso" dataKeyY="pctPrazo" color={COR_GRAFICO_POSITIVO} isPercent={true} />
                            <ChartModule data={topCursosAtencao} title="Top 5 Cursos (Mais Atrasos)" dataKeyX="nomeCurso" dataKeyY="totAtraso" color={COR_GRAFICO_NEGATIVO} isPercent={false} />
                        </div>
                        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <ChartModule data={topFrequencia} title="Mais Frequentes (Menos dias ausentes)" dataKeyX="nomeAbreviado" dataKeyY="mediaAcesso" color={COR_GRAFICO_POSITIVO} isPercent={false} />
                            <ChartModule data={bottomFrequencia} title="Menos Frequentes (Mais dias ausentes)" dataKeyX="nomeAbreviado" dataKeyY="mediaAcesso" color={COR_GRAFICO_NEGATIVO} isPercent={false} />
                        </div>
                    </>
                )}
            </div>

            <DetalhamentoPendentesModal isOpen={isPendentesModalOpen} onClose={() => setIsPendentesModalOpen(false)} atividadesPendentes={dadosPendentesParaModal} />
        </div>
    );
};

export default RelatorioPeriodo;