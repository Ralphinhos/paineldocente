
import React, { FC } from 'react';
import { FilterState } from '../types';

interface FilterControlsProps {
    filters: FilterState;
    filterOptions: {
        semestres: string[];
        modalidades: string[];
        modulos: string[];
        cursos: string[];
    };
    onFilterChange: (key: keyof FilterState, value: string) => void;
}

export const FilterControls: FC<FilterControlsProps> = ({ filters, filterOptions, onFilterChange }) => {
    const selectClasses = "block w-full px-3 py-1.5 text-sm rounded-md shadow-sm " +
                          "bg-white border-gray-300 text-slate-700 " +
                          "focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 " +
                          "dark:bg-slate-700 dark:border-slate-600 dark:text-gray-300 dark:placeholder-gray-400 " + 
                          "dark:focus:ring-cyan-600 dark:focus:border-cyan-600";
    const labelClasses = "text-sm font-medium text-slate-600 dark:text-gray-400";

    return (
    <div className="flex items-center gap-3 md:gap-4 flex-wrap">
      <div className="flex items-center gap-2">
        <label htmlFor="filtro-semestre" className={labelClasses}>Semestre:</label>
        <select 
            id="filtro-semestre" 
            className={selectClasses} 
            value={filters.semestre} 
            onChange={(e) => onFilterChange('semestre', e.target.value)}
        >
          <option value="Todos">Selecione...</option>
          {filterOptions.semestres.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="filtro-modalidade" className={labelClasses}>Modalidade:</label>
        <select 
            id="filtro-modalidade" 
            className={selectClasses}
            value={filters.modalidade} 
            onChange={(e) => onFilterChange('modalidade', e.target.value)}
        >
          <option value="Todos">Selecione...</option>
          {filterOptions.modalidades.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="filtro-curso" className={labelClasses}>Curso:</label>
        <select
            id="filtro-curso"
            className={selectClasses}
            value={filters.curso}
            onChange={(e) => onFilterChange('curso', e.target.value)}
            disabled={filters.modalidade === 'Todos' || filterOptions.cursos.length === 0}
        >
          <option value="Todos">Todos</option>
          {filterOptions.cursos.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="filtro-modulo" className={labelClasses}>Módulo:</label>
        <select
            id="filtro-modulo"
            className={selectClasses}
            value={filters.modulo}
            onChange={(e) => onFilterChange('modulo', e.target.value)}
            disabled={filters.modalidade === 'Todos' || filterOptions.modulos.length === 0}
        >
          <option value="Todos">Todos</option>
          {filterOptions.modulos.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
    </div>
    );
};
