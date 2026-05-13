// src/types/index.ts

export interface ProcessedData {
  Docente: string;
  Disciplina: string;
  Curso: string;
  Modalidade: string;
  Semestre: string;
  Módulo: string;
  Atividade: string;
  'Data Limite Construção': string;
  'Entregue': string | null;
  'Dias s/ Acesso': number;
  Coordenador: string;
  email_coordenador: string;
  email_docente: string;
  Login: string;
  statusCalculado: string;
  diasCalculado: number;
  isPendente: boolean;
  isAtrasado: boolean;
  isEntregueNoPrazo: boolean;
  DataTerminoPrevisto?: Date | null;
  DataInicioSemestre?: Date | null;
}

export interface HistoryReport {
  id: string;
  created_at: string;
  label: string;
  data?: any[];
}

export interface KPIData {
  totalPendentesModalidade: number;
  totalAtrasadasModalidade: number;
  docenteMaiorMediaAtraso: { nome: string; mediaDias: number; } | null;
  docenteMaisPendencias: { nome: string; quantidade: number; } | null;
  docenteMenosAcesso: { 
    nome: string; 
    mediaDiasSemAcesso: number; 
    disciplinaDestaque: string; 
    diasDisciplinaDestaque: number; 
  } | null;
  pendentes: number; 
  atrasadas: number; 
}

export interface Coordinator {
  username: string;
  fullName: string;
  courses: string[];
  password?: string;
}

export interface DocenteStats {
  docente: string;
  stats: {
      entregue: number;
      atrasado: number;
      pendente: number;
      total: number;
      diasSemAcesso: number;
  };
  score: number;
  criticality: number;
}

export interface FilterState {
  semestre: string;
  modalidade: string;
  modulo: string;
  curso: string;
}

export interface DocentePerformance {
  nomeDocente: string;
  totalAtividades: number;
  totalAtrasadas: number;
  porcentagemAtraso: number;
  totalEntreguesNoPrazo: number;
  porcentagemEntreguesNoPrazo: number;
}

export interface IKpisPeriodo {
  totalAtividadesConsideradas: number;
  totalEntreguesNoPrazo: number;
  totalEntreguesComAtraso: number;
  totalPendentes: number;
  porcentagemEntreguesNoPrazo: number;
  porcentagemComAtraso: number; 
  porcentagemPendentes: number;
  mediaDiasAtraso: number; 
}

export interface CursoPerformance {
  nomeCurso: string;
  totalAtividadesCurso: number;
  totalAtrasadasCurso: number;
  porcentagemAtrasoCurso: number;
  totalEntreguesNoPrazoCurso: number;
  porcentagemEntreguesNoPrazoCurso: number;
}