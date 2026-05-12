import React, { createContext, ReactNode, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ProcessedData } from '../types';

export interface IDataContextProps {
  allData: ProcessedData[];
  isLoading: boolean;
  error: string | null;
  fetchData: (historyId?: string) => Promise<any>;
  historyList: any[];
  fetchHistoryList: () => Promise<any>;
  selectedHistory: string;
  setSelectedHistory: (id: string) => void;
}

export const DataContext = createContext<IDataContextProps | undefined>(undefined);

export const useDataContext = () => {
  const context = React.useContext(DataContext);
  if (!context) throw new Error('useDataContext deve ser usado dentro de um DataProvider');
  return context;
};

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedHistory, setSelectedHistory] = useState<string>('current');

  const { data: historyList = [], refetch: fetchHistoryList } = useQuery({
    queryKey: ['historyList'],
    queryFn: async () => {
      const token = localStorage.getItem('authToken'); // Pega o token salvo
      const res = await fetch('/api/history', {
        headers: {
          'Authorization': `Bearer ${token}` // Envia o crachá para o backend
        }
      });
      if (!res.ok) throw new Error("Erro buscar históricos");
      return res.json();
    }
  });

  const { data: allData = [], isLoading, error: queryError, refetch: fetchData } = useQuery({
    queryKey: ['dados', selectedHistory],
    queryFn: async () => {
      const token = localStorage.getItem('authToken'); // Pega o token salvo
      const url = selectedHistory === 'current' ? '/api/dados' : `/api/dados?history_id=${selectedHistory}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}` // Envia o crachá para o backend
        }
      });

      if (!response.ok) throw new Error(`Erro na rede: ${response.statusText}`);
      const rawData: any[] = await response.json();
      return rawData.map((item: any) => ({
        ...item,
        DataTerminoPrevisto: item.DataTerminoPrevisto ? new Date(item.DataTerminoPrevisto) : null,
        DataInicioSemestre: item.DataInicioSemestre ? new Date(item.DataInicioSemestre) : null,
      }));
    },
    staleTime: 60 * 1000, 
  });

  const contextValue: IDataContextProps = {
    allData,
    isLoading,
    error: queryError ? queryError.message : null,
    fetchData: fetchData as any,
    historyList,
    fetchHistoryList: fetchHistoryList as any,
    selectedHistory,
    setSelectedHistory
  };

  return <DataContext.Provider value={contextValue}>{children}</DataContext.Provider>;
};