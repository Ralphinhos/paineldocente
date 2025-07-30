import React, { ReactNode } from 'react';

interface KpiCardProps {
  titulo: string;
  valor: string | number;
  unidade?: string;
  descricao?: string;
  corValor?: string; // ex: 'text-green-500', 'text-red-500'
  className?: string; // Para classes de estilização adicionais no container do card
  // icone?: ReactNode; // Para adicionar um ícone no futuro, se desejado
}

export const KpiCard: React.FC<KpiCardProps> = ({
  titulo,
  valor,
  unidade,
  descricao,
  corValor = 'text-slate-700 dark:text-white', // Cor padrão se não especificada
  className = '',
  // icone,
}) => {
  return (
    <div 
      className={`bg-white dark:bg-slate-800 p-4 shadow-lg rounded-lg flex flex-col justify-between h-full ${className}`}
    >
      <div>
        {/* Futuramente, se houver ícone:
        {icone && <div className="mb-2 text-slate-500 dark:text-slate-400">{icone}</div>} */}
        <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1 truncate" title={titulo}>
          {titulo}
        </h4>
        <p className={`text-3xl font-bold ${corValor}`}>
          {valor}
          {unidade && <span className="text-lg ml-1">{unidade}</span>}
        </p>
      </div>
      {descricao && (
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 truncate" title={descricao}>
          {descricao}
        </p>
      )}
    </div>
  );
};

// Export default para permitir importação mais fácil se for o único export do arquivo
// No entanto, como estamos em /ui, manter export const é comum.
// Se preferir default: export default KpiCard;
