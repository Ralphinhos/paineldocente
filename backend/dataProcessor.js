const processData = (data) => {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return data.map((row) => {
    const entregueRaw = row['Entregue'] || row['ENTREGUE'];
    const isEntregue = entregueRaw && entregueRaw.trim() !== '';

    // Parseia a data limite (DD/MM/YYYY ou YYYY-MM-DD)
    let dataLimite = null;
    const dataLimiteRaw = row['Data Limite Construção'] || row['Data Limite Construcao'] || '';
    if (dataLimiteRaw && dataLimiteRaw.trim() !== '') {
      const partes = dataLimiteRaw.trim().split(/[\/\-]/);
      if (partes.length === 3) {
        // DD/MM/YYYY
        if (partes[0].length <= 2) {
          dataLimite = new Date(
            parseInt(partes[2], 10),
            parseInt(partes[1], 10) - 1,
            parseInt(partes[0], 10)
          );
        } else {
          // YYYY-MM-DD
          dataLimite = new Date(
            parseInt(partes[0], 10),
            parseInt(partes[1], 10) - 1,
            parseInt(partes[2], 10)
          );
        }
        dataLimite.setHours(0, 0, 0, 0);
        if (isNaN(dataLimite.getTime())) dataLimite = null;
      }
    }

    // Calcula dias de atraso em relação à data limite
    let diasCalculado = 0;
    if (dataLimite) {
      const diffMs = hoje.getTime() - dataLimite.getTime();
      const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      diasCalculado = diffDias > 0 ? diffDias : 0;
    }

    // Lógica de status:
    // - isPendente: não entregue E prazo já passou (ou sem prazo = pendente também)
    // - isAtrasado: entregue, MAS o prazo já havia passado na data de hoje
    //   (assume-se que se foi entregue e dataLimite < hoje, foi entregue com atraso)
    // - isEntregueNoPrazo: entregue E prazo ainda não passou (ou não há prazo)
    const prazoPassed = dataLimite ? dataLimite < hoje : false;

    const isPendente = !isEntregue;
    const isAtrasado = isEntregue && prazoPassed;
    const isEntregueNoPrazo = isEntregue && !prazoPassed;

    let statusCalculado = 'Pendente';
    if (isAtrasado) statusCalculado = 'Entregue com Atraso';
    else if (isEntregueNoPrazo) statusCalculado = 'Entregue';

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