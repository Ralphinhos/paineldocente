
import React, { FC } from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
}

export const LoadingScreen: FC<LoadingScreenProps> = ({ message = "Carregando dados..." }) => {
  return (
    <div className="fixed inset-0 bg-gray-100 dark:bg-[#0f172a] bg-opacity-90 dark:bg-opacity-90 flex items-center justify-center z-50 transition-opacity duration-300 backdrop-blur-sm">
      <div className="text-center">
        <Loader2 className="h-8 w-8 text-cyan-500 dark:text-[#00adc7] mx-auto animate-spin" />
        <p className="mt-3 text-lg font-semibold text-slate-700 dark:text-gray-200">{message}</p>
      </div>
    </div>
  );
};
