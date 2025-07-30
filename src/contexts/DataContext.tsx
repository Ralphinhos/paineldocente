import React, { createContext, ReactNode, useCallback, useState, useEffect } from 'react';
import { ProcessedData, FilterState } from '../types';

// Interface para as opções de filtro que virão da API
export interface FilterOptions {
  semestres: string[];
  modalidades: string[];
  modulos: string[];
  cursos: string[];
}

// Interface para descrever os dados e funções que o contexto fornecerá
export interface IDataContextProps {
  data: ProcessedData[];
  filterOptions: FilterOptions;
  isLoading: boolean;
  error: string | null;
  fetchData: (filters: FilterState, coordinatorCourses?: string[]) => Promise<void>;
  fetchAllData: () => Promise<ProcessedData[]>;
  clearData: () => void;
}

// Criar o Contexto
export const DataContext = createContext<IDataContextProps | undefined>(undefined);

// Hook customizado para facilitar o uso do DataContext
export const useDataContext = () => {
  const context = React.useContext(DataContext);
  if (context === undefined) {
    throw new Error('useDataContext deve ser usado dentro de um DataProvider');
  }
  return context;
};

// Props para o DataProvider
interface DataProviderProps {
  children: ReactNode;
}

// Componente Provider
export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  const [data, setData] = useState<ProcessedData[]>([]);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    semestres: [],
    modalidades: [],
    modulos: [],
    cursos: [],
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Função para buscar os dados filtrados do backend
  const fetchData = useCallback(async (filters: FilterState, coordinatorCourses: string[] = []) => {
    console.log("[DataContext] Buscando dados com filtros:", filters, "Cursos do Coordenador:", coordinatorCourses);
    setIsLoading(true);
    setError(null);

    // Constrói a query string a partir dos filtros
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== 'Todos') {
        params.append(key, value);
      }
    });

    // Adiciona os cursos do coordenador ao filtro, se aplicável
    if (coordinatorCourses.length > 0) {
        params.append('cursosCoordenador', coordinatorCourses.join(','));
    }

    try {
      const response = await fetch(`/api/dados?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Erro na rede: ${response.statusText}`);
      }

      const processed: ProcessedData[] = await response.json();
      
      // Converte as strings de data para objetos Date
      const dataWithDates = processed.map(item => ({
        ...item,
        DataTerminoPrevisto: item.DataTerminoPrevisto ? new Date(item.DataTerminoPrevisto) : null,
        DataInicioSemestre: item.DataInicioSemestre ? new Date(item.DataInicioSemestre) : null,
      }));

      setData(dataWithDates);
      console.log("[DataContext] Dados filtrados recebidos:", dataWithDates.length, "linhas");

    } catch (err) {
      console.error("[DataContext] Erro ao buscar dados filtrados:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Não foi possível carregar os dados do servidor. Detalhes: ${errorMessage}`);
      setData([]); // Limpa os dados em caso de erro
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Efeito para buscar as opções de filtro uma vez, no carregamento inicial
  useEffect(() => {
    const fetchFilterOptions = async () => {
      console.log("[DataContext] Buscando opções de filtro...");
      try {
        const response = await fetch('/api/filter-options');
        if (!response.ok) {
          throw new Error('Não foi possível carregar as opções de filtro.');
        }
        const options: FilterOptions = await response.json();
        setFilterOptions(options);
        console.log("[DataContext] Opções de filtro carregadas:", options);
      } catch (err) {
        console.error("[DataContext] Erro ao buscar opções de filtro:", err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(`Falha ao carregar opções de filtro: ${errorMessage}`);
      } finally {
        // Marcamos o carregamento como falso aqui, assumindo que os dados iniciais
        // serão buscados por uma chamada explícita de `fetchData` na página.
        setIsLoading(false);
      }
    };

    fetchFilterOptions();
  }, []);

  const clearData = useCallback(() => {
    setData([]);
  }, []);

  const fetchAllData = useCallback(async (): Promise<ProcessedData[]> => {
    console.log("[DataContext] Buscando TODOS os dados para o relatório...");
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/dados`);
      if (!response.ok) {
        throw new Error(`Erro na rede: ${response.statusText}`);
      }
      const processed: ProcessedData[] = await response.json();
      const dataWithDates = processed.map(item => ({
        ...item,
        DataTerminoPrevisto: item.DataTerminoPrevisto ? new Date(item.DataTerminoPrevisto) : null,
        DataInicioSemestre: item.DataInicioSemestre ? new Date(item.DataInicioSemestre) : null,
      }));
      console.log("[DataContext] Todos os dados recebidos:", dataWithDates.length, "linhas");
      return dataWithDates;
    } catch (err) {
      console.error("[DataContext] Erro ao buscar todos os dados:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Não foi possível carregar os dados completos. Detalhes: ${errorMessage}`);
      return []; // Retorna array vazio em caso de erro
    } finally {
      setIsLoading(false);
    }
  }, []);

  const contextValue: IDataContextProps = {
    data,
    filterOptions,
    isLoading,
    error,
    fetchData,
    fetchAllData,
    clearData,
  };

  return (
    <DataContext.Provider value={contextValue}>
      {children}
    </DataContext.Provider>
  );
};
