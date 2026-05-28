const processData = (data) => {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // Função auxiliar para evitar repetição de código ao extrair e validar datas
  const parseDate = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string' || dateStr.trim() === '') return null;
    const partes = dateStr.trim().split(/[\/\-]/);
    if (partes.length === 3) {
      let dt;
      if (partes[0].length <= 2) {
        // Formato: DD/MM/YYYY
        dt = new Date(
          parseInt(partes[2], 10),
          parseInt(partes[1], 10) - 1,
          parseInt(partes[0], 10)
        );
      } else {
        // Formato: YYYY-MM-DD
        dt = new Date(
          parseInt(partes[0], 10),
          parseInt(partes[1], 10) - 1,
          parseInt(partes[2], 10)
        );
      }
      dt.setHours(0, 0, 0, 0);
      return isNaN(dt.getTime()) ? null : dt;
    }
    return null;
  };

  return data.map((row) => {
    const entregueRaw = row['Entregue'] || row['ENTREGUE'];
    const dataLimiteRaw = row['Data Limite Construção'] || row['Data Limite Construcao'] || '';

    // Transforma as duas colunas em objetos Date para possibilitar a comparação matemática
    const dataEntregue = parseDate(entregueRaw);
    const dataLimite = parseDate(dataLimiteRaw);

    // Se houver qualquer conteúdo preenchido na coluna, consideramos como entregue
    const isEntregue = entregueRaw && entregueRaw.trim() !== '';

    // Lógica de status baseada na data real de entrega
    const isPendente = !isEntregue;
    let isAtrasado = false;
    let isEntregueNoPrazo = false;

    if (isEntregue) {
      if (dataEntregue && dataLimite) {
        // É considerado atrasado apenas se a data enviada for MAIOR que a data limite
        isAtrasado = dataEntregue > dataLimite;
        isEntregueNoPrazo = !isAtrasado;
      } else {
        // Se foi entregue mas a atividade não possuía data limite, consideramos no prazo
        isEntregueNoPrazo = true;
      }
    }

    // Calcula dias de atraso de forma precisa
    let diasCalculado = 0;
    if (dataLimite) {
      if (isPendente) {
        // Se ainda não entregou, os dias de atraso correm até a data de HOJE
        const diffMs = hoje.getTime() - dataLimite.getTime();
        const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        diasCalculado = diffDias > 0 ? diffDias : 0;
      } else if (isAtrasado && dataEntregue) {
        // Se entregou com atraso, os dias de atraso "congelam" usando a diferença 
        // entre a data em que efetivamente enviou e a data limite
        const diffMs = dataEntregue.getTime() - dataLimite.getTime();
        const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        diasCalculado = diffDias > 0 ? diffDias : 0;
      }
    }

    let statusCalculado = 'Pendente';
    if (isAtrasado) statusCalculado = 'Entregue com Atraso';
    else if (isEntregueNoPrazo) statusCalculado = 'Entregue';

    // Restante da lógica de limpeza de dados original...
    const diasSemAcessoStr =
      row['Dias s/ Acesso'] ||
      row['Dias S/ Acesso'] ||
      row['Dias S/Acesso'] ||
      row['Dias s/Acesso'];
    let diasSemAcessoNum = null;

    if (
      diasSemAcessoStr !== undefined &&
      diasSemAcessoStr !== null &&
      diasSemAcessoStr.toString().trim() !== ''
    ) {
      const parsed = parseInt(diasSemAcessoStr, 10);
      if (!isNaN(parsed)) {
        diasSemAcessoNum = parsed;
      }
    }

    const moduloValue = row['Módulo'] || row['Modulo'];
    const codDisciplina =
      row['Cód. Disciplina'] ||
      row['Cod. Disciplina'] ||
      row['Cód.Disciplina'] ||
      row['Cód_Disciplina'] ||
      '';
    const codCurso =
      row['Cód. Curso'] ||
      row['Cod. Curso'] ||
      row['Cód.Curso'] ||
      row['Cód_Curso'] ||
      '';

    return {
      ...row,
      'Módulo': moduloValue,
      'Cód. Disciplina': codDisciplina,
      'Cód. Curso': codCurso,
      'Dias s/ Acesso': diasSemAcessoNum,
      statusCalculado,
      diasCalculado,
      isPendente,
      isAtrasado,
      isEntregueNoPrazo,
    };
  });
};

module.exports = { processData };