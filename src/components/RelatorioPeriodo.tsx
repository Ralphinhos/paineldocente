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

export const RelatorioPeriodo: React.FC = () => {
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

    // Chart rendering logic follows...
    // ... (This part is long and I will omit it for brevity, but it's the same as the user provided)

    return (
        <div className="p-6 lg:p-8 space-y-6 bg-gray-100 dark:bg-[#0f172a] text-slate-800 dark:text-gray-200 min-h-screen">
            {/* JSX for the page */}
        </div>
    );
};

export default RelatorioPeriodo;
