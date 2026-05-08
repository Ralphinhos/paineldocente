import React, { createContext, ReactNode, useCallback, useState, useEffect } from 'react';
import { ProcessedData } from '../types';

export interface IDataContextProps {
  allData: ProcessedData[];
  isLoading: boolean;
  error: string | null;
  fetchData: (historyId?: string) => Promise<void>;
  historyList: any[];
  fetchHistoryList: () => Promise<void>;
  selectedHistory: string;
  setSelectedHistory: (id: string) => void;
}

export const DataContext = createContext<IDataContextProps | undefined>(undefined);

export const useDataContext = () => {
  const context = React.useContext(DataContext);
  if (context === undefined) {
    throw new Error('useDataContext deve ser usado dentro de um DataProvider');
  }
  return context;
};

interface DataProviderProps {
  children: ReactNode;
}

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  const [allData, setAllData] = useState<ProcessedData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<string>('current');

  const fetchHistoryList = useCallback(async () => {
    try {
      const res = await fetch('/api/history');
      if (res.ok) {
        const data = await res.json();
        setHistoryList(data);
      }
    } catch (err) {
      console.error("Erro ao buscar lista de históricos:", err);
    }
  }, []);

  const fetchData = useCallback(async (historyId: string = 'current') => {
    console.log(`[DataContext] Buscando todos os dados da API (historyId: ${historyId})...`);
    setIsLoading(true);
    setError(null);
    try {
      const url = historyId === 'current' ? '/api/dados' : `/api/dados?history_id=${historyId}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Erro na rede: ${response.statusText}`);
      }
      const rawData: any[] = await response.json();
      const dataWithDates = rawData.map(item => ({
        ...item,
        DataTerminoPrevisto: item.DataTerminoPrevisto ? new Date(item.DataTerminoPrevisto) : null,
        DataInicioSemestre: item.DataInicioSemestre ? new Date(item.DataInicioSemestre) : null,
      }));
      setAllData(dataWithDates);
      console.log("[DataContext] Todos os dados carregados:", dataWithDates.length, "linhas");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("[DataContext] Erro ao buscar todos os dados:", errorMessage);
      setError(`Não foi possível carregar os dados. Detalhes: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistoryList();
  }, [fetchHistoryList]);

  useEffect(() => {
    fetchData(selectedHistory);
  }, [fetchData, selectedHistory]);

  const contextValue: IDataContextProps = {
    allData,
    isLoading,
    error,
    fetchData,
    historyList,
    fetchHistoryList,
    selectedHistory,
    setSelectedHistory
  };

  return (
    <DataContext.Provider value={contextValue}>
      {children}
    </DataContext.Provider>
  );
};
