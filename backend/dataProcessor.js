const processData = (data) => {
  return data.map((row) => {
    const entregueRaw = row['Entregue'] || row['ENTREGUE'];
    const isEntregue = entregueRaw && entregueRaw.trim() !== '';
    
    let statusCalculado = isEntregue ? 'Entregue' : 'Pendente';
    let isPendente = !isEntregue;
    let isEntregueNoPrazo = isEntregue; 

    const diasSemAcessoStr = row['Dias s/ Acesso'] || row['Dias S/ Acesso'] || row['Dias S/Acesso'] || row['Dias s/Acesso'];
    let diasSemAcessoNum = null; // Tratado como null (Nunca Acessou)

    if (diasSemAcessoStr !== undefined && diasSemAcessoStr !== null && diasSemAcessoStr.toString().trim() !== '') {
        const parsed = parseInt(diasSemAcessoStr, 10);
        if (!isNaN(parsed)) {
            diasSemAcessoNum = parsed;
        }
    }

    const moduloValue = row['Módulo'] || row['Modulo'];
    const codDisciplina = row['Cód. Disciplina'] || row['Cod. Disciplina'] || row['Cód.Disciplina'] || row['Cód_Disciplina'] || '';
    const codCurso = row['Cód. Curso'] || row['Cod. Curso'] || row['Cód.Curso'] || row['Cód_Curso'] || '';

    return {
      ...row,
      'Módulo': moduloValue,
      'Cód. Disciplina': codDisciplina,
      'Cód. Curso': codCurso,
      'Dias s/ Acesso': diasSemAcessoNum,
      statusCalculado,
      diasCalculado: 0,
      isPendente,
      isAtrasado: false,
      isEntregueNoPrazo
    };
  });
};

module.exports = { processData };