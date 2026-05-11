import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useDataContext } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { LoadingScreen } from '../components/LoadingScreen';
import { Sidebar } from '../components/Sidebar';
import { FilterControls } from '../components/FilterControls';
import AccessTable from '../components/AccessTable';
import { ActivitiesTable } from '../components/ActivitiesTable';
import { PerformanceAnalysis } from '../components/PerformanceAnalysis';
import { VisaoGeral } from '../components/VisaoGeral';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProcessedData, FilterState, KPIData } from '../types';
import { useNavigate } from 'react-router-dom';
// ATUALIZAÇÃO AQUI: Importando ícones Save e Calendar
import { LogOut, FileText, Save, Calendar } from 'lucide-react';
import { ThemeSwitcher } from '../components/ThemeSwitcher';
import useIdleTimer from '../hooks/useIdleTimer';
import { toast as sonnerToast } from "@/components/ui/sonner";

export default function Index() {
    const navigate = useNavigate();
    
    const { 
        allData, 
        isLoading: isDataLoading, 
        error: dataError,
        historyList,
        fetchHistoryList, // Precisamos disso para atualizar a lista após salvar
        selectedHistory,
        setSelectedHistory 
    } = useDataContext();
    
    const { user, logout } = useAuth();
    
    const [filters, setFilters] = useState<FilterState>({ semestre: 'Todos', modalidade: 'Todos', modulo: 'Todos', curso: 'Todos' });
    const [selectedDocente, setSelectedDocente] = useState<string | null>(null);
    const [isNotifying, setIsNotifying] = useState(false);
    
    // Novo estado para o loading do botão de salvar
    const [isSaving, setIsSaving] = useState(false);

    const handleLogout = useCallback(() => {
        logout();
    }, [logout]);

    useIdleTimer(10 * 60 * 1000, handleLogout);

    const baseDataForView = useMemo(() => {
        if (!user) return [];
        if (user.role === 'admin') {
            return allData;
        }
        if (!user.username) return [];
        return allData.filter(row => row.Login === user.username);
    }, [allData, user]);

    const filteredData = useMemo(() => {
        if (filters.modalidade === 'Todos') {
            return [];
        }
        const appliedFiltersResult = baseDataForView.filter(row =>
            (filters.semestre === 'Todos' || row.Semestre === filters.semestre) &&
            (row.Modalidade === filters.modalidade) &&
            (filters.modulo === 'Todos' || row['Módulo'] === filters.modulo) &&
            (filters.curso === 'Todos' || row.Curso === filters.curso)
        );
        return appliedFiltersResult;
    }, [filters, baseDataForView]);

    const filterOptions = useMemo(() => {
        const semestres = [...new Set(baseDataForView.map(item => item.Semestre).filter(Boolean))].sort();
        const modalidades = [...new Set(baseDataForView.map(item => item.Modalidade).filter(Boolean))].sort();
        
        const baseParaModulosECursos = filters.modalidade === 'Todos'
            ? baseDataForView
            : baseDataForView.filter(item => item.Modalidade === filters.modalidade);
        
        const modulos = [...new Set(baseParaModulosECursos.map(item => item['Módulo']).filter(Boolean))].sort();
        const cursos = [...new Set(baseParaModulosECursos.map(item => item.Curso).filter(Boolean))].sort();
        
        return { semestres, modalidades, modulos, cursos };
    }, [baseDataForView, filters.modalidade]);

    const handleFilterChange = (key: keyof FilterState, value: string) => {
        setFilters(prev => ({
            ...prev,
            [key]: value,
            ...(key === 'modalidade' && { modulo: 'Todos', curso: 'Todos' })
        }));
        setSelectedDocente(null);
    };
    
    const handleDocenteSelect = (docente: string) => {
        setSelectedDocente(selectedDocente === docente ? null : docente);
    };

    // Função para salvar o estado atual no Supabase
    const handleSaveHistory = async () => {
        try {
            setIsSaving(true);
            const response = await fetch('/api/history', { method: 'POST' });
            
            if (response.ok) {
                sonnerToast.success("Estado atual salvo com sucesso!");
                await fetchHistoryList(); // Recarrega a lista de datas no select
            } else {
                const errData = await response.json();
                sonnerToast.error(errData.error || "Erro ao salvar histórico.");
            }
        } catch (error) {
            sonnerToast.error("Erro de conexão ao tentar salvar o histórico.");
        } finally {
            setIsSaving(false);
        }
    };

    const kpis = useMemo((): KPIData => {
        const initialKpiState: KPIData = {
            totalPendentesModalidade: 0, totalAtrasadasModalidade: 0,
            docenteMaiorMediaAtraso: null, docenteMaisPendencias: null, docenteMenosAcesso: null,
            pendentes: 0, atrasadas: 0,
        };
        if (filteredData.length === 0) return initialKpiState;
        
        const totalPendentesModalidade = filteredData.filter(r => r.isPendente).length;
        const totalAtrasadasModalidade = filteredData.filter(r => r.isAtrasado).length;
        
        const atividadesAtrasadas = filteredData.filter(r => r.isAtrasado && r.diasCalculado > 0);
        const docentesComAtraso: Record<string, { totalDiasAtraso: number; countAtrasos: number }> = 
            atividadesAtrasadas.reduce((acc, curr) => {
                acc[curr.Docente] = acc[curr.Docente] || { totalDiasAtraso: 0, countAtrasos: 0 };
                acc[curr.Docente].totalDiasAtraso += curr.diasCalculado;
                acc[curr.Docente].countAtrasos += 1;
                return acc;
            }, {} as Record<string, { totalDiasAtraso: number; countAtrasos: number }>);

        let maiorMedia = -1;
        let nomeDocenteComMaiorMedia: string | null = null;
        for (const nomeDocente in docentesComAtraso) {
            const media = docentesComAtraso[nomeDocente].totalDiasAtraso / docentesComAtraso[nomeDocente].countAtrasos;
            if (media > maiorMedia) {
                maiorMedia = media;
                nomeDocenteComMaiorMedia = nomeDocente;
            }
        }

        const atividadesPendentes = filteredData.filter(r => r.isPendente);
        const pendenciasPorDocente = atividadesPendentes.reduce((acc, curr) => {
            acc[curr.Docente] = (acc[curr.Docente] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        let maxPendencias = 0;
        let nomeDocenteComMaisPend: string | null = null;
        for (const nomeDocente in pendenciasPorDocente) {
            if (pendenciasPorDocente[nomeDocente] > maxPendencias) {
                maxPendencias = pendenciasPorDocente[nomeDocente];
                nomeDocenteComMaisPend = nomeDocente;
            }
        }

        const dadosDiasAcesso: Record<string, { totalDias: number; count: number; maxDias: number; disciplina: string }> = {};
        filteredData.forEach(row => {
            const dias = row['Dias s/ Acesso'];
            if (typeof dias === 'number') {
                dadosDiasAcesso[row.Docente] = dadosDiasAcesso[row.Docente] || { totalDias: 0, count: 0, maxDias: -1, disciplina: '' };
                dadosDiasAcesso[row.Docente].totalDias += dias;
                dadosDiasAcesso[row.Docente].count += 1;
                if (dias > dadosDiasAcesso[row.Docente].maxDias) {
                    dadosDiasAcesso[row.Docente].maxDias = dias;
                    dadosDiasAcesso[row.Docente].disciplina = row.Disciplina;
                }
            }
        });

        let nomeDocenteMenosAcesso: string | null = null;
        let maiorMaxDias = -1;
        for (const nomeDocente in dadosDiasAcesso) {
            if (dadosDiasAcesso[nomeDocente].maxDias > maiorMaxDias) {
                maiorMaxDias = dadosDiasAcesso[nomeDocente].maxDias;
                nomeDocenteMenosAcesso = nomeDocente;
            }
        }

        return {
            totalPendentesModalidade,
            totalAtrasadasModalidade,
            docenteMaiorMediaAtraso: nomeDocenteComMaiorMedia ? { nome: nomeDocenteComMaiorMedia, mediaDias: Math.round(maiorMedia) } : null,
            docenteMaisPendencias: nomeDocenteComMaisPend ? { nome: nomeDocenteComMaisPend, quantidade: maxPendencias } : null,
            docenteMenosAcesso: nomeDocenteMenosAcesso ? {
                nome: nomeDocenteMenosAcesso,
                mediaDiasSemAcesso: Math.round(dadosDiasAcesso[nomeDocenteMenosAcesso].totalDias / dadosDiasAcesso[nomeDocenteMenosAcesso].count),
                disciplinaDestaque: dadosDiasAcesso[nomeDocenteMenosAcesso].disciplina,
                diasDisciplinaDestaque: dadosDiasAcesso[nomeDocenteMenosAcesso].maxDias
            } : null,
            pendentes: totalPendentesModalidade,
            atrasadas: totalAtrasadasModalidade,
        };
    }, [filteredData]);
    
    const handleNotification = async (action: string) => {
        sonnerToast.info("Funcionalidade em Desenvolvimento", {
            description: `A notificação para '${action}' está sendo preparada e estará disponível em breve.`,
            duration: 5000,
        });
    };
    
    if (isDataLoading) {
        return <LoadingScreen message="Carregando dados..." />;
    }

    if (dataError) {
        return <div className="text-red-500 text-center p-4">Erro ao carregar dados: {dataError}</div>;
    }

    return (
        <div className="flex h-screen bg-[#0f172a] font-sans overflow-hidden">
            <style>{`
                @keyframes sonner-progress-bar-animation {
                  from { transform: scaleX(1); }
                  to { transform: scaleX(0); }
                }
                .custom-toast-progress::after, 
                .toast-progress-error::after, 
                .toast-progress-success::after {
                  content: '';
                  position: absolute; 
                  bottom: 0;
                  left: 0;
                  height: 2px;
                  width: 100%; 
                  background-color: rgba(255, 255, 255, 0.7); 
                  transform-origin: left; 
                  animation-name: sonner-progress-bar-animation;
                  animation-timing-function: linear;
                  animation-fill-mode: forwards;
                  animation-duration: calc(var(--toast-duration, 4s) - 0.2s); 
                }
                .toast-progress-error::after {
                  background-color: rgba(220, 53, 69, 0.8); 
                }
                .toast-progress-success::after {
                  background-color: rgba(25, 135, 84, 0.8); 
                }
                
                :root { 
                    --scrollbar-thumb: #475569; 
                    --scrollbar-track: transparent; 
                }
                html.dark {
                    --scrollbar-thumb: #374151;
                }
                /* For Webkit Browsers */
                ::-webkit-scrollbar { width: 8px; height: 8px; }
                ::-webkit-scrollbar-track { background: var(--scrollbar-track); }
                ::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 10px; }
                ::-webkit-scrollbar-thumb:hover { background: #64748b; }
                html.dark ::-webkit-scrollbar-thumb:hover { background: #4b5563; }

                /* For Firefox */
                html {
                    scrollbar-width: thin;
                    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
                }

                .table-container { height: calc(30vh); min-height: 200px; }
                .status-badge { font-size: 0.75rem; line-height: 1rem; font-weight: 500; padding: 0.25rem 0.625rem; border-radius: 9999px; white-space: nowrap; }
            `}</style>
            <Sidebar kpis={kpis} userRole={user?.role ?? null} onNotification={handleNotification} isNotifying={isNotifying} />
            <main className="flex-1 p-6 lg:p-8 space-y-6 overflow-y-auto bg-gray-100 dark:bg-[#0f172a] text-slate-800 dark:text-gray-200">
                <header className="space-y-4">
                    <div className="flex justify-between items-center gap-4">
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Acompanhamento de Disciplinas</h2>
                        
                        {/* ATUALIZAÇÃO: Container flex-wrap para estruturar os grupos de botões */}
                        <div className="flex flex-wrap items-center gap-3">
                            
                            {/* GRUPO 1: Relatórios e Histórico (Apenas Admin) */}
                            {user?.role === 'admin' && (
                                <div className="flex items-center bg-white dark:bg-slate-800 rounded-lg p-1 border border-gray-200 dark:border-slate-700 shadow-sm">
                                    
                                    <button 
                                        onClick={() => navigate('/relatorio-periodo')} 
                                        title="Relatório do Semestre" 
                                        className="p-2 flex items-center justify-center rounded-md text-slate-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                                    >
                                        <FileText size={18} />
                                    </button>

                                    <div className="w-px h-5 bg-gray-200 dark:bg-slate-700 mx-1" />

                                    <button 
                                        onClick={handleSaveHistory} 
                                        disabled={isSaving}
                                        title="Salvar Estado Atual (Criar Histórico)" 
                                        className="p-2 flex items-center justify-center rounded-md text-slate-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
                                    >
                                        <Save size={18} />
                                    </button>
                                    
                                    <div className="w-px h-5 bg-gray-200 dark:bg-slate-700 mx-1" />

                                    {/* Select Personalizado com ícone de calendário */}
                                    <div className="relative flex items-center px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors cursor-pointer group">
                                        <Calendar size={18} className="text-slate-600 dark:text-gray-300 mr-2 shrink-0" />
                                        <select
    value={selectedHistory}
    onChange={(e) => setSelectedHistory(e.target.value)}
    title="Visualizar estado de uma data anterior"
    className="appearance-none bg-transparent text-sm font-medium text-slate-600 dark:text-gray-300 outline-none cursor-pointer pr-6 w-auto min-w-[180px]"
>
    <option value="current" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-gray-200">
        Estado Atual
    </option>
    {historyList && historyList.map((hist: any) => {
        let label = hist.label || hist.id;
        if (hist.created_at && !hist.label) {
            const d = new Date(hist.created_at);
            label = d.toLocaleDateString('pt-BR', { 
                day: '2-digit', month: '2-digit', year: 'numeric', 
                hour: '2-digit', minute: '2-digit' 
            });
        }
        return (
            <option key={hist.id} value={hist.id} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-gray-200">
                {label}
            </option>
        );
    })}
</select>
                                        {/* Seta customizada que aponta para baixo */}
                                        <div className="absolute right-2 pointer-events-none text-slate-400 dark:text-slate-500">
                                            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                            </svg>
                                        </div>
                                    </div>

                                </div>
                            )}

                            {/* GRUPO 2: Sistema */}
                            <div className="flex items-center bg-white dark:bg-slate-800 rounded-lg p-1 border border-gray-200 dark:border-slate-700 shadow-sm">
                                <ThemeSwitcher />
                                <div className="w-px h-5 bg-gray-200 dark:bg-slate-700 mx-1" />
                                <button onClick={handleLogout} title="Sair" className="p-2 flex items-center justify-center rounded-md text-slate-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                                    <LogOut size={18} />
                                </button>
                            </div>
                            
                        </div>
                    </div>
                    <div>
                        <FilterControls filters={filters} filterOptions={filterOptions} onFilterChange={handleFilterChange} />
                    </div>
                </header>
                <Tabs defaultValue="detalhado" className="w-full">
                    <TabsList className="bg-transparent p-0 gap-4">
                        <TabsTrigger
                            value="detalhado"
                            className="px-4 py-2 rounded-md text-sm font-medium transition-all 
                                       text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700 
                                       hover:bg-slate-100 dark:hover:bg-slate-800
                                       data-[state=active]:bg-cyan-500 dark:data-[state=active]:bg-cyan-600 
                                       data-[state=active]:text-white dark:data-[state=active]:text-white 
                                       data-[state=active]:border-cyan-500 dark:data-[state=active]:border-cyan-600"
                        >
                            Visão Detalhada
                        </TabsTrigger>
                        <TabsTrigger
                            value="geral"
                            className="px-4 py-2 rounded-md text-sm font-medium transition-all 
                                       text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700 
                                       hover:bg-slate-100 dark:hover:bg-slate-800
                                       data-[state=active]:bg-cyan-500 dark:data-[state=active]:bg-cyan-600 
                                       data-[state=active]:text-white dark:data-[state=active]:text-white 
                                       data-[state=active]:border-cyan-500 dark:data-[state=active]:border-cyan-600"
                        >
                            Visão Geral
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="detalhado">
                        <div className="grid grid-cols-1 gap-6 mt-4">
                           <AccessTable data={filteredData} />
                            <ActivitiesTable 
                                data={filteredData} 
                                onDocenteSelect={handleDocenteSelect}
                                selectedDocente={selectedDocente}
                            />
                            <PerformanceAnalysis 
                                data={filteredData} 
                                onAnalysis={() => {}} 
                                selectedDocente={selectedDocente}
                            />
                        </div>
                    </TabsContent>
                    <TabsContent value="geral">
                        <VisaoGeral data={filteredData} />
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
}