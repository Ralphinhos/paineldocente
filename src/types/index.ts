// src/types/index.ts

// A declaração global para 'Papa' e a interface 'RawData' foram removidas
// pois o parsing dos dados agora é feito no backend.

export interface ProcessedData {
  Docente: string;
  Disciplina: string;
  Curso: string;
  Modalidade: string;
  Semestre: string;
  Módulo: string;
  Atividade: string;
  'Data Limite Construção': string; // Mantido como string, pois o backend pode enviá-lo assim.
  'Entregue': string | null; // Pode ser uma string de data ou nulo.
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
  // O frontend espera objetos Date, que são convertidos no DataContext após o fetch.
  DataTerminoPrevisto?: Date | null;
  DataInicioSemestre?: Date | null;
}

export interface KPIData {
  // KPIs que dependem da seleção de modalidade
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
  // Mantidos para possível uso futuro ou como fallback se a lógica mudar, mas os novos acima são prioritários
  pendentes: number; // Pode ser o total geral, independente de modalidade, se necessário
  atrasadas: number; // Pode ser o total geral, independente de modalidade, se necessário
}

// Definição para os dados do Coordenador
  export interface Coordinator {
    username: string; // e.g., ana.tomaz (da coluna 'Login')
    fullName: string; // e.g., Ana Clara Tomaz (da coluna 'Coordenador')
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
  mediaDiasAtraso: number; // Para atividades efetivamente atrasadas que tiveram diasCalculado > 0
}

export interface CursoPerformance {
  nomeCurso: string;
  totalAtividadesCurso: number;
  totalAtrasadasCurso: number;
  porcentagemAtrasoCurso: number;
  totalEntreguesNoPrazoCurso: number;
  porcentagemEntreguesNoPrazoCurso: number;
}

// Interface DisciplinaPerformance removida conforme solicitação.