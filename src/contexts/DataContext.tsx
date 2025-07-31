import React, { createContext, ReactNode, useCallback, useState, useEffect } from 'react';
import { ProcessedData } from '../types';

export interface IDataContextProps {
  allData: ProcessedData[];
  isLoading: boolean;
  error: string | null;
  fetchData: () => Promise<void>;
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

  const fetchData = useCallback(async () => {
    console.log("[DataContext] Buscando todos os dados da API...");
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/dados`);
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
    fetchData();
  }, [fetchData]);

  const contextValue: IDataContextProps = {
    allData,
    isLoading,
    error,
    fetchData,
  };

  return (
    <DataContext.Provider value={contextValue}>
      {children}
    </DataContext.Provider>
  );
};
