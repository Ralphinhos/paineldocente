import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
    const navigate = useNavigate();
    
    const [allData, setAllData] = useState<ProcessedData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [dataError, setDataError] = useState<string | null>(null);
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

    useEffect(() => {
        const fetchAllDataForReport = async () => {
            setIsLoading(true);
            setDataError(null);
            try {
                // Adicionado um parâmetro para indicar que queremos todos os dados para o relatório.
                // O backend pode precisar disso para diferenciar de uma chamada de filtro vazia.
                const response = await fetch('/api/dados?source=relatorio');
                if (!response.ok) {
                    throw new Error(`Erro na rede: ${response.statusText}`);
                }
                const rawData: ProcessedData[] = await response.json();
                const dataWithDates = rawData.map(item => ({
                    ...item,
                    DataTerminoPrevisto: item.DataTerminoPrevisto ? new Date(item.DataTerminoPrevisto) : null,
                    DataInicioSemestre: item.DataInicioSemestre ? new Date(item.DataInicioSemestre) : null,
                }));
                setAllData(dataWithDates);
            } catch (err) {
                const error = err as Error;
                setDataError(`Falha ao carregar dados para o relatório: ${error.message}`);
            } finally {
                setIsLoading(false);
            }
        };
        fetchAllDataForReport();
    }, []);
    
    const modalidadesUnicas = useMemo(() => {
        return [...new Set(allData.map(item => item.Modalidade).filter(Boolean).sort())] as string[];
    }, [allData]);

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
        const dadosFiltrados = allData.filter(item => {
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

    let chartContentDocentesMelhor = <p className="text-sm text-slate-500 dark:text-gray-400">Não há dados suficientes...</p>;
    if (topDocentesMelhorPerformance.length > 0) {
        chartContentDocentesMelhor = (
            <ResponsiveContainer width="100%" height={350}>
                <BarChart data={topDocentesMelhorPerformance} margin={{ top: 20, right: 30, left: 20, bottom: 70 }}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                    <XAxis type="category" dataKey="nomeAbreviado" tick={{ fontSize: 9, fill: '#FFFFFF' }} interval={0} angle={-30} textAnchor="end" height={60} />
                    <YAxis type="number" domain={[0, 100]} width={0} tick={false} axisLine={{ stroke: '#FFFFFF', strokeOpacity: 0.5 }} tickLine={{ stroke: '#FFFFFF', strokeOpacity: 0.5 }} tickFormatter={(value) => `${value.toFixed(0)}%`} />
                    <Tooltip formatter={(value: number, name: string, props: any) => { if (name === 'porcentagemEntreguesNoPrazo') { return [ `${value.toFixed(1)}% No Prazo`, `Entregues: ${props.payload.totalEntreguesNoPrazo} de ${props.payload.totalAtividades}` ]; } return [value, name]; }} labelFormatter={(label: string, payload: any[]) => <span style={{ fontWeight: '600', color: '#334155' }}>{payload && payload.length ? payload[0].payload.nomeDocente : label}</span>} contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', color: '#334155', border: '1px solid #e2e8f0', borderRadius: '0.5rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="porcentagemEntreguesNoPrazo" fill={COR_GRAFICO_POSITIVO} >
                        <LabelList dataKey="porcentagemEntreguesNoPrazo" position="center" style={{ fill: '#FFFFFF', fontSize: 10 }} formatter={(value: number) => `${value.toFixed(1)}%`} />
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        );
    }

    let chartContentDocentesAtencao = <p className="text-sm text-slate-500 dark:text-gray-400">Não há dados suficientes...</p>;
    if (topDocentesPontosAtencao.length > 0) {
        chartContentDocentesAtencao = (
            <ResponsiveContainer width="100%" height={350}>
                <BarChart data={topDocentesPontosAtencao} margin={{ top: 20, right: 30, left: 20, bottom: 70 }}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                    <XAxis type="category" dataKey="nomeAbreviado" tick={{ fontSize: 9, fill: '#FFFFFF' }} interval={0} angle={-30} textAnchor="end" height={60} />
                    <YAxis type="number" domain={[0, 'auto']} width={0} tick={false} axisLine={{ stroke: '#FFFFFF', strokeOpacity: 0.5 }} tickLine={{ stroke: '#FFFFFF', strokeOpacity: 0.5 }} allowDecimals={false} />
                    <Tooltip formatter={(value: number, name: string, props: any) => { if (name === 'totalAtrasadas') { return [ `${props.payload.totalAtrasadas} de ${props.payload.totalAtividades} atrasadas (${props.payload.porcentagemAtraso.toFixed(1)}%)`, `Docente: ${props.payload.nomeDocente}` ]; } return [value, name]; }} labelFormatter={(label: string, payload: any[]) => { if (payload && payload.length && payload[0].payload.nomeDocente) { return <span style={{ fontWeight: '600', color: '#334155' }}>{payload[0].payload.nomeDocente}</span>; } return <span style={{ fontWeight: '600', color: '#334155' }}>{label}</span>; }} contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', color: '#334155', border: '1px solid #e2e8f0', borderRadius: '0.5rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="totalAtrasadas" fill={COR_GRAFICO_NEGATIVO}>
                        <LabelList dataKey="totalAtrasadas" position="center" style={{ fill: '#fef2f2', fontSize: 10 }} />
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        );
    }

    let chartContentCursosMelhor = <p className="text-sm text-slate-500 dark:text-gray-400">Não há dados suficientes...</p>;
    if (topCursosMelhorPerformance.length > 0) {
        chartContentCursosMelhor = (
            <ResponsiveContainer width="100%" height={350}>
                <BarChart data={topCursosMelhorPerformance} margin={{ top: 20, right: 30, left: 20, bottom: 70 }}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                    <XAxis type="category" dataKey="nomeCurso" tick={{ fontSize: 9, fill: '#FFFFFF' }} interval={0} angle={-30} textAnchor="end" height={60} />
                    <YAxis type="number" domain={[0, 100]} width={0} tick={false} axisLine={{ stroke: '#FFFFFF', strokeOpacity: 0.5 }} tickLine={{ stroke: '#FFFFFF', strokeOpacity: 0.5 }} tickFormatter={(value) => `${value.toFixed(0)}%`} />
                    <Tooltip formatter={(value: number, name: string, props: any) => { if (name === 'porcentagemEntreguesNoPrazoCurso') { return [ `${value.toFixed(1)}% No Prazo`, `Entregues: ${props.payload.totalEntreguesNoPrazoCurso} de ${props.payload.totalAtividadesCurso}` ]; } return [value, name]; }} labelFormatter={(label: string) => <span style={{ fontWeight: '600', color: '#334155' }}>{label}</span>} contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', color: '#334155', border: '1px solid #e2e8f0', borderRadius: '0.5rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="porcentagemEntreguesNoPrazoCurso" fill={COR_GRAFICO_POSITIVO} >
                        <LabelList dataKey="porcentagemEntreguesNoPrazoCurso" position="center" style={{ fill: '#FFFFFF', fontSize: 10 }} formatter={(value: number) => `${value.toFixed(1)}%`} />
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        );
    }
    
    let chartContentCursosAtencao = <p className="text-sm text-slate-500 dark:text-gray-400">Não há dados suficientes...</p>;
    if (topCursosPontosAtencao.length > 0) {
        chartContentCursosAtencao = (
            <ResponsiveContainer width="100%" height={350}>
                <BarChart data={topCursosPontosAtencao} margin={{ top: 20, right: 30, left: 20, bottom: 70 }}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                    <XAxis type="category" dataKey="nomeCurso" tick={{ fontSize: 9, fill: '#FFFFFF' }} interval={0} angle={-30} textAnchor="end" height={60} />
                    <YAxis type="number" domain={[0, 'auto']} width={0} tick={false} axisLine={{ stroke: '#FFFFFF', strokeOpacity: 0.5 }} tickLine={{ stroke: '#FFFFFF', strokeOpacity: 0.5 }} allowDecimals={false} />
                    <Tooltip formatter={(value: number, name: string, props: any) => { if (name === 'totalAtrasadasCurso') { return [ `${props.payload.totalAtrasadasCurso} de ${props.payload.totalAtividadesCurso} atrasadas (${props.payload.porcentagemAtrasoCurso.toFixed(1)}%)`, ]; } return [value, name]; }} labelFormatter={(label: string) => <span style={{ fontWeight: '600', color: '#334155' }}>{label}</span>} contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', color: '#334155', border: '1px solid #e2e8f0', borderRadius: '0.5rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="totalAtrasadasCurso" fill={COR_GRAFICO_NEGATIVO}>
                        <LabelList dataKey="totalAtrasadasCurso" position="center" style={{ fill: '#fef2f2', fontSize: 10 }} />
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        );
    }

    return (
        <div className="p-6 lg:p-8 space-y-6 bg-gray-100 dark:bg-[#0f172a] text-slate-800 dark:text-gray-200 min-h-screen">
            <header className="space-y-2 mb-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Relatório do Semestre</h2>
                    <button onClick={() => navigate('/')} className="px-4 py-2 text-sm font-medium text-cyan-700 dark:text-cyan-500 bg-cyan-100 dark:bg-cyan-700/30 rounded-md hover:bg-cyan-200 dark:hover:bg-cyan-700/50 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500" > &larr; Voltar ao Painel Principal </button>
                </div>
                <p className="text-sm text-slate-600 dark:text-gray-400"> Selecione o ano, semestre e modalidade para gerar o relatório consolidado. </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end p-4 bg-white dark:bg-slate-800 rounded-lg shadow">
                <div>
                    <label htmlFor="ano-relatorio" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Ano:</label>
                    <input type="number" id="ano-relatorio" placeholder="Ex: 2024" value={anoSelecionado} onChange={(e) => setAnoSelecionado(e.target.value)} className="block w-full px-3 py-1.5 text-sm rounded-md shadow-sm bg-white border-gray-300 text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-300 dark:placeholder-gray-400 dark:focus:ring-cyan-600 dark:focus:border-cyan-600" />
                </div>
                <div>
                    <label htmlFor="semestre-relatorio" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Semestre:</label>
                    <select id="semestre-relatorio" value={semestreFiltro} onChange={(e) => setSemestreFiltro(e.target.value)} className="block w-full px-3 py-1.5 text-sm rounded-md shadow-sm bg-white border-gray-300 text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-300 dark:placeholder-gray-400 dark:focus:ring-cyan-600 dark:focus:border-cyan-600">
                        <option value="0">Ambos os Semestres</option>
                        <option value="1">1º Semestre</option>
                        <option value="2">2º Semestre</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="modalidade-relatorio" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Modalidade:</label>
                    <select id="modalidade-relatorio" value={modalidadeSelecionada} onChange={(e) => setModalidadeSelecionada(e.target.value)} className="block w-full px-3 py-1.5 text-sm rounded-md shadow-sm bg-white border-gray-300 text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-300 dark:placeholder-gray-400 dark:focus:ring-cyan-600 dark:focus:border-cyan-600">
                        <option value="Todas">Todas as Modalidades</option>
                        {modalidadesUnicas.map(mod => (<option key={mod} value={mod}>{mod}</option>))}
                    </select>
                </div>
                <button onClick={handleGerarRelatorio} className="w-full md:w-auto px-4 py-2 text-sm font-semibold text-white bg-cyan-600 rounded-md hover:bg-cyan-700 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800"> Gerar Relatório </button>
            </div>

            {kpisPeriodo && (
            <div className="mt-6 p-4 bg-slate-100 dark:bg-slate-900 rounded-lg shadow">
                <h3 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">Resumo Geral do Semestre</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    <KpiCard titulo="Total de Atividades" valor={kpisPeriodo.totalAtividadesConsideradas} />
                    <KpiCard titulo="% Entregues no Prazo" valor={kpisPeriodo.porcentagemEntreguesNoPrazo.toFixed(1)} unidade="%" corValor={kpisPeriodo.porcentagemEntreguesNoPrazo >= 70 ? 'text-green-500 dark:text-green-400' : kpisPeriodo.porcentagemEntreguesNoPrazo >= 50 ? 'text-amber-500 dark:text-amber-400' : 'text-red-500 dark:text-red-400'} descricao={`${kpisPeriodo.totalEntreguesNoPrazo} atividades`} />
                    <KpiCard titulo="% Entregues com Atraso" valor={kpisPeriodo.porcentagemComAtraso.toFixed(1)} unidade="%" corValor={kpisPeriodo.porcentagemComAtraso > 20 ? 'text-red-500 dark:text-red-400' : kpisPeriodo.porcentagemComAtraso > 10 ? 'text-amber-500 dark:text-amber-400' : 'text-slate-700 dark:text-white'} descricao={`${kpisPeriodo.totalEntreguesComAtraso} atividades`} />
                    <div onClick={handleAbrirModalPendentes} className="cursor-pointer hover:opacity-80 transition-opacity">
                        <KpiCard titulo="% Pendentes" valor={kpisPeriodo.porcentagemPendentes.toFixed(1)} unidade="%" corValor={kpisPeriodo.porcentagemPendentes > 15 ? 'text-red-500 dark:text-red-400' : kpisPeriodo.porcentagemPendentes > 5 ? 'text-amber-500 dark:text-amber-400' : 'text-slate-700 dark:text-white'} descricao={`${kpisPeriodo.totalPendentes} atividades (clique para ver)`} />
                    </div>
                    <KpiCard titulo="Média Dias de Atraso" valor={Math.round(kpisPeriodo.mediaDiasAtraso)} unidade="dias" descricao="Para atividades entregues com atraso" corValor={kpisPeriodo.mediaDiasAtraso > 7 ? 'text-red-500 dark:text-red-400' : kpisPeriodo.mediaDiasAtraso > 3 ? 'text-amber-500 dark:text-amber-400' : 'text-slate-700 dark:text-white'} />
                </div>
            </div>
            )}

            {relatorioGerado && relatorioGerado.length > 0 && (
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 bg-white dark:bg-slate-800 rounded-lg shadow min-h-[300px]">
                        <h4 className="text-lg font-semibold text-slate-700 dark:text-white mb-3">Top 5 Docentes (Melhor % Entregas no Prazo)</h4>
                        {chartContentDocentesMelhor}
                    </div>

                    <div className="p-4 bg-white dark:bg-slate-800 rounded-lg shadow min-h-[300px]">
                        <h4 className="text-lg font-semibold text-slate-700 dark:text-white mb-3">Top 5 Docentes (Maior Quantidade de Atrasos)</h4>
                        {chartContentDocentesAtencao}
                    </div>
                </div>
            )}

            {relatorioGerado && relatorioGerado.length > 0 && (
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 bg-white dark:bg-slate-800 rounded-lg shadow min-h-[300px]">
                        <h4 className="text-lg font-semibold text-slate-700 dark:text-white mb-3">Top 5 Cursos (Melhor % Entregas no Prazo)</h4>
                        {chartContentCursosMelhor}
                    </div>

                    <div className="p-4 bg-white dark:bg-slate-800 rounded-lg shadow min-h-[300px]">
                        <h4 className="text-lg font-semibold text-slate-700 dark:text-white mb-3">Top 5 Cursos (Maior Quantidade de Atrasos)</h4>
                        {chartContentCursosAtencao}
                    </div>
                </div>
            )}

            <DetalhamentoPendentesModal isOpen={isPendentesModalOpen} onClose={() => setIsPendentesModalOpen(false)} atividadesPendentes={dadosPendentesParaModal} />
        </div>
    );
};

export default RelatorioPeriodo;
