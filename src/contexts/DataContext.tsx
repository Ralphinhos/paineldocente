// src/contexts/DataContext.tsx
import React, { createContext, ReactNode, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ProcessedData, HistoryReport } from '../types';
import { useAuth } from './AuthContext';

export interface IDataContextProps {
  allData: ProcessedData[];
  isLoading: boolean;
  error: string | null;
  fetchData: () => void;
  historyList: HistoryReport[];
  fetchHistoryList: () => void;
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
  
  const { isAuthenticated, token: authToken } = useAuth(); 
  const isEnabled = isAuthenticated || !!localStorage.getItem('authToken');

  const { data: historyList = [], refetch: fetchHistoryList } = useQuery<HistoryReport[]>({
    queryKey: ['historyList'],
    queryFn: async () => {
      const token = authToken || localStorage.getItem('authToken');
      const res = await fetch('/api/history', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error("Erro buscar históricos");
      return res.json();
    },
    enabled: isEnabled 
  });

  const { data: allData = [], isLoading, error: queryError, refetch: fetchData } = useQuery<ProcessedData[]>({
    queryKey: ['dados', selectedHistory],
    queryFn: async () => {
      const token = authToken || localStorage.getItem('authToken');
      const url = selectedHistory === 'current' ? '/api/dados' : `/api/dados?history_id=${selectedHistory}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
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
    enabled: isEnabled
  });

  const contextValue = useMemo(() => ({
    allData,
    isLoading,
    error: queryError ? queryError.message : null,
    fetchData: fetchData as unknown as () => void,
    historyList,
    fetchHistoryList: fetchHistoryList as unknown as () => void,
    selectedHistory,
    setSelectedHistory
  }), [allData, isLoading, queryError, fetchData, historyList, fetchHistoryList, selectedHistory]);

  return <DataContext.Provider value={contextValue}>{children}</DataContext.Provider>;
};