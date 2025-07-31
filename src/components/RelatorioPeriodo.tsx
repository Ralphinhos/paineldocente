import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataContext } from '../contexts/DataContext';
import { ProcessedData, DocentePerformance, IKpisPeriodo, CursoPerformance } from '../types';
import { LoadingScreen } from './LoadingScreen';
import useIdleTimer from '../hooks/useIdleTimer';
import { KpiCard } from './ui/KpiCard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { DetalhamentoPendentesModal } from './modals/DetalhamentoPendentesModal';

const COR_GRAFICO_POSITIVO = "#22c55e";
const COR_GRAFICO_NEGATIVO = "#ef4444";

const shortenName = (name: string): string => {
    if (typeof name !== 'string' || !name.trim()) return 'N/D';
    const parts = name.trim().split(/\s+/);
    if (parts.length > 1) {
        return `${parts[0]} ${parts[parts.length - 1]}`;
    }
    return name;
};

const RelatorioPeriodo: React.FC = () => {
    console.log('[DEBUG] Componente RelatorioPeriodo renderizado.');
    const navigate = useNavigate();
    const { allData, isLoading, error: dataError } = useDataContext();

    const IDLE_TIMEOUT_RELATORIO = 10 * 60 * 1000;
    const handleRelatorioIdleLogout = useCallback(() => {
        localStorage.clear();
        navigate('/login');
    }, [navigate]);
    useIdleTimer(IDLE_TIMEOUT_RELATORIO, handleRelatorioIdleLogout);

    useEffect(() => {
        const storedUserRole = localStorage.getItem('userRole');
        if (storedUserRole !== 'admin') {
            navigate('/'); 
        }
    }, [navigate]);
    
    const [anoSelecionado, setAnoSelecionado] = useState<string>(new Date().getFullYear().toString());
    const [semestreFiltro, setSemestreFiltro] = useState<string>('0');
    const [modalidadeSelecionada, setModalidadeSelecionada] = useState<string>('Todas');
    const [relatorioGerado, setRelatorioGerado] = useState<ProcessedData[] | null>(null);
    const [topDocentesMelhorPerformance, setTopDocentesMelhorPerformance] = useState<DocentePerformance[]>([]);
    const [topDocentesPontosAtencao, setTopDocentesPontosAtencao] = useState<DocentePerformance[]>([]);
    const [kpisPeriodo, setKpisPeriodo] = useState<IKpisPeriodo | null>(null);
    const [topCursosMelhorPerformance, setTopCursosMelhorPerformance] = useState<CursoPerformance[]>([]);
    const [topCursosPontosAtencao, setTopCursosPontosAtencao] = useState<CursoPerformance[]>([]);
    const [isPendentesModalOpen, setIsPendentesModalOpen] = useState(false);
    const [dadosPendentesParaModal, setDadosPendentesParaModal] = useState<ProcessedData[]>([]);

    const availableData = allData; 

    const modalidadesUnicas = useMemo(() => {
        return [...new Set(availableData.map(item => item.Modalidade).filter(Boolean).sort())] as string[];
    }, [availableData]);

    const handleAbrirModalPendentes = () => {
        if (relatorioGerado && relatorioGerado.length > 0) {
            const pendentes = relatorioGerado.filter(item => item.isPendente === true);
            setDadosPendentesParaModal(pendentes);
            setIsPendentesModalOpen(true);
        } else {
            setDadosPendentesParaModal([]);
            setIsPendentesModalOpen(true);
        }
    };

    const handleGerarRelatorio = () => {
        if (!anoSelecionado) {
            alert("Por favor, informe o Ano.");
            return;
        }
        const dadosFiltrados = availableData.filter(item => {
            const modalidadeMatch = modalidadeSelecionada === 'Todas' || item.Modalidade === modalidadeSelecionada;
            let semestreMatch = false;
            if (item.Semestre) {
                if (semestreFiltro === '0') {
                    semestreMatch = item.Semestre.startsWith(`${anoSelecionado}_`);
                } else {
                    semestreMatch = item.Semestre === `${anoSelecionado}_${semestreFiltro}`;
                }
            }
            return modalidadeMatch && semestreMatch;
        });
        setRelatorioGerado(dadosFiltrados);

        if (dadosFiltrados.length > 0) {
            const perfDocentes = calcularPerformanceDocentes(dadosFiltrados);
            setTopDocentesMelhorPerformance([...perfDocentes].sort((a,b) => b.porcentagemEntreguesNoPrazo - a.porcentagemEntreguesNoPrazo || b.totalAtividades - a.totalAtividades).slice(0,5).map(d=>({...d, nomeAbreviado: shortenName(d.nomeDocente)})));
            setTopDocentesPontosAtencao([...perfDocentes].sort((a,b) => b.porcentagemAtraso - a.porcentagemAtraso || b.totalAtividades - a.totalAtividades).slice(0,5).map(d=>({...d, nomeAbreviado: shortenName(d.nomeDocente)})));
            setKpisPeriodo(calcularKpisGerais(dadosFiltrados));
            const perfCursos = calcularPerformanceCursos(dadosFiltrados);
            setTopCursosMelhorPerformance([...perfCursos].sort((a,b) => b.porcentagemEntreguesNoPrazoCurso - a.porcentagemEntreguesNoPrazoCurso || b.totalAtividadesCurso - a.totalAtividadesCurso).slice(0,5));
            setTopCursosPontosAtencao([...perfCursos].sort((a,b) => b.porcentagemAtrasoCurso - a.porcentagemAtrasoCurso || b.totalAtividadesCurso - a.totalAtividadesCurso).slice(0,5));
        } else {
            setTopDocentesMelhorPerformance([]); setTopDocentesPontosAtencao([]); setKpisPeriodo(null);
            setTopCursosMelhorPerformance([]); setTopCursosPontosAtencao([]);
        }
    };

    const calcularPerformanceDocentes = (dados: ProcessedData[]): DocentePerformance[] => {
        if (!dados || dados.length === 0) return [];
        const map: Map<string, { totalAtividades: number; totalAtrasadas: number; totalEntreguesNoPrazo: number; }> = new Map();
        dados.forEach(item => {
            if (!item.Docente) return;
            const s = map.get(item.Docente) || { totalAtividades: 0, totalAtrasadas: 0, totalEntreguesNoPrazo: 0 };
            s.totalAtividades++; if (item.isAtrasado) s.totalAtrasadas++; if (item.isEntregueNoPrazo) s.totalEntreguesNoPrazo++;
            map.set(item.Docente, s);
        });
        return Array.from(map.entries()).map(([nome, stats]) => ({
            nomeDocente: nome, ...stats,
            porcentagemAtraso: stats.totalAtividades > 0 ? (stats.totalAtrasadas / stats.totalAtividades) * 100 : 0,
            porcentagemEntreguesNoPrazo: stats.totalAtividades > 0 ? (stats.totalEntreguesNoPrazo / stats.totalAtividades) * 100 : 0,
        }));
    };

    const calcularKpisGerais = (dados: ProcessedData[]): IKpisPeriodo | null => {
        if (!dados || dados.length === 0) return null;
        let tENP = 0, tECA = 0, tP = 0, sDA = 0, cAATMPM = 0;
        dados.forEach(i => { 
            if (i.isEntregueNoPrazo) tENP++; if (i.isAtrasado && !i.isPendente) tECA++; if (i.isPendente) tP++;
            if (i.isAtrasado && !i.isPendente && i.diasCalculado && i.diasCalculado > 0) { sDA += i.diasCalculado; cAATMPM++; }
        });
        const tAC = dados.length;
        return {
            totalAtividadesConsideradas: tAC, totalEntreguesNoPrazo: tENP, totalEntreguesComAtraso: tECA, totalPendentes: tP,
            porcentagemEntreguesNoPrazo: tAC > 0 ? (tENP / tAC) * 100 : 0,
            porcentagemComAtraso: tAC > 0 ? (tECA / tAC) * 100 : 0,
            porcentagemPendentes: tAC > 0 ? (tP / tAC) * 100 : 0,
            mediaDiasAtraso: cAATMPM > 0 ? sDA / cAATMPM : 0,
        };
    };

    const calcularPerformanceCursos = (dados: ProcessedData[]): CursoPerformance[] => {
        if (!dados || dados.length === 0) return [];
        const map: Map<string, { totalAtividadesCurso: number; totalAtrasadasCurso: number; totalEntreguesNoPrazoCurso: number;}> = new Map();
        dados.forEach(item => {
            if (!item.Curso) return;
            const s = map.get(item.Curso) || { totalAtividadesCurso: 0, totalAtrasadasCurso: 0, totalEntreguesNoPrazoCurso: 0 };
            s.totalAtividadesCurso++; if (item.isAtrasado) s.totalAtrasadasCurso++; if (item.isEntregueNoPrazo) s.totalEntreguesNoPrazoCurso++;
            map.set(item.Curso, s);
        });
        return Array.from(map.entries()).map(([nome, stats]) => ({
            nomeCurso: nome, ...stats,
            porcentagemAtrasoCurso: stats.totalAtividadesCurso > 0 ? (stats.totalAtrasadasCurso / stats.totalAtividadesCurso) * 100 : 0,
            porcentagemEntreguesNoPrazoCurso: stats.totalAtividadesCurso > 0 ? (stats.totalEntreguesNoPrazoCurso / stats.totalAtividadesCurso) * 100 : 0,
        }));
    };

    if (isLoading) return <LoadingScreen message="Carregando dados para o relatório..." />;
    if (dataError) return <div className="p-4 text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 rounded-md">Erro ao carregar dados: {dataError}</div>;

    return (
        <div className="p-6 lg:p-8 space-y-6 bg-gray-100 dark:bg-[#0f172a] text-slate-800 dark:text-gray-200 min-h-screen">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Relatório por Período</h1>
                <button onClick={() => navigate('/')} className="text-sm text-blue-500 hover:underline">Voltar</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-lg bg-white dark:bg-slate-800/50 shadow">
                <div>
                    <label htmlFor="ano-selecionado" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ano</label>
                    <input type="number" id="ano-selecionado" name="ano-selecionado" value={anoSelecionado} onChange={e => setAnoSelecionado(e.target.value)} className="w-full p-2 rounded-md bg-gray-200 dark:bg-slate-700 border-gray-300 dark:border-slate-600 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                    <label htmlFor="semestre-filtro" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Semestre</label>
                    <select id="semestre-filtro" name="semestre-filtro" value={semestreFiltro} onChange={e => setSemestreFiltro(e.target.value)} className="w-full p-2 rounded-md bg-gray-200 dark:bg-slate-700 border-gray-300 dark:border-slate-600 focus:ring-blue-500 focus:border-blue-500">
                        <option value="0">Ambos</option>
                        <option value="1">1º Semestre</option>
                        <option value="2">2º Semestre</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="modalidade-selecionada" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Modalidade</label>
                    <select id="modalidade-selecionada" name="modalidade-selecionada" value={modalidadeSelecionada} onChange={e => setModalidadeSelecionada(e.target.value)} className="w-full p-2 rounded-md bg-gray-200 dark:bg-slate-700 border-gray-300 dark:border-slate-600 focus:ring-blue-500 focus:border-blue-500">
                        <option value="Todas">Todas</option>
                        {modalidadesUnicas.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>
                <div className="flex items-end">
                    <button onClick={handleGerarRelatorio} className="w-full px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-md transition-colors duration-200">
                        Gerar Relatório
                    </button>
                </div>
            </div>

            {relatorioGerado && kpisPeriodo && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        <KpiCard titulo="Total de Atividades" valor={kpisPeriodo.totalAtividadesConsideradas} />
                        <KpiCard titulo="Entregues no Prazo" valor={`${kpisPeriodo.porcentagemEntreguesNoPrazo.toFixed(1)}%`} descricao={`Total: ${kpisPeriodo.totalEntreguesNoPrazo}`} />
                        <KpiCard titulo="Entregues com Atraso" valor={`${kpisPeriodo.porcentagemComAtraso.toFixed(1)}%`} descricao={`Total: ${kpisPeriodo.totalEntreguesComAtraso}`} />
                        <KpiCard titulo="Pendentes" valor={`${kpisPeriodo.porcentagemPendentes.toFixed(1)}%`} descricao={`Total: ${kpisPeriodo.totalPendentes}`} />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-white dark:bg-slate-800/50 p-4 rounded-lg shadow">
                            <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-white">Top 5 Docentes - Melhor Performance</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={topDocentesMelhorPerformance} layout="vertical" margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" domain={[0, 100]} />
                                    <YAxis dataKey="nomeAbreviado" type="category" width={100} />
                                    <Tooltip formatter={(value:any) => `${value.toFixed(1)}%`} />
                                    <Bar dataKey="porcentagemEntreguesNoPrazo" fill={COR_GRAFICO_POSITIVO}>
                                        <LabelList dataKey="porcentagemEntreguesNoPrazo" position="right" formatter={(value:any) => `${value.toFixed(1)}%`} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="bg-white dark:bg-slate-800/50 p-4 rounded-lg shadow">
                            <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-white">Top 5 Docentes - Pontos de Atenção</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={topDocentesPontosAtencao} layout="vertical" margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" domain={[0, 100]} />
                                    <YAxis dataKey="nomeAbreviado" type="category" width={100} />
                                    <Tooltip formatter={(value:any) => `${value.toFixed(1)}%`} />
                                    <Bar dataKey="porcentagemAtraso" fill={COR_GRAFICO_NEGATIVO}>
                                         <LabelList dataKey="porcentagemAtraso" position="right" formatter={(value:any) => `${value.toFixed(1)}%`} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-white dark:bg-slate-800/50 p-4 rounded-lg shadow">
                            <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-white">Top 5 Cursos - Melhor Performance</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={topCursosMelhorPerformance} layout="vertical" margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" domain={[0, 100]} />
                                    <YAxis dataKey="nomeCurso" type="category" width={150} />
                                    <Tooltip formatter={(value:any) => `${value.toFixed(1)}%`} />
                                    <Bar dataKey="porcentagemEntreguesNoPrazoCurso" fill={COR_GRAFICO_POSITIVO}>
                                        <LabelList dataKey="porcentagemEntreguesNoPrazoCurso" position="right" formatter={(value:any) => `${value.toFixed(1)}%`} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="bg-white dark:bg-slate-800/50 p-4 rounded-lg shadow">
                            <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-white">Top 5 Cursos - Pontos de Atenção</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={topCursosPontosAtencao} layout="vertical" margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" domain={[0, 100]} />
                                    <YAxis dataKey="nomeCurso" type="category" width={150} />
                                    <Tooltip formatter={(value:any) => `${value.toFixed(1)}%`} />
                                    <Bar dataKey="porcentagemAtrasoCurso" fill={COR_GRAFICO_NEGATIVO}>
                                        <LabelList dataKey="porcentagemAtrasoCurso" position="right" formatter={(value:any) => `${value.toFixed(1)}%`} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}
            
            <DetalhamentoPendentesModal
                isOpen={isPendentesModalOpen}
                onClose={() => setIsPendentesModalOpen(false)}
                atividadesPendentes={dadosPendentesParaModal}
            />
        </div>
    );
};

export default RelatorioPeriodo;