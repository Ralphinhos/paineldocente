// Função principal que processa os dados brutos
const processData = (data) => {
  return data.map((row) => {
    
    // Na nova regra, se a coluna "Entregue" da planilha (que agora conterá uma data)
    // tiver valor preenchido, é "Entregue". Se estiver vazio, é "Pendente" ("Não Entregue").
    const entregueRaw = row['Entregue'] || row['ENTREGUE'];
    const isEntregue = entregueRaw && entregueRaw.trim() !== '';
    
    let statusCalculado = isEntregue ? 'Entregue' : 'Pendente';
    let isPendente = !isEntregue;
    let isEntregueNoPrazo = isEntregue; // Simplificação: se entregou, assume no prazo por enquanto

    // Normaliza o campo 'Dias s/ Acesso' para garantir que seja sempre um número
    // Na planilha 0 significa acesso hoje, vazio significa nunca acessou.
    // Vamos tratar vazio como um número grande ou null. O frontend lida melhor com números.
    const diasSemAcessoStr = row['Dias s/ Acesso'] || row['Dias S/ Acesso'] || row['Dias S/Acesso'] || row['Dias s/Acesso'];
    let diasSemAcessoNum = null; // null ou outro valor para indicar "nunca acessou"

    if (diasSemAcessoStr !== undefined && diasSemAcessoStr !== null && diasSemAcessoStr.toString().trim() !== '') {
        const parsed = parseInt(diasSemAcessoStr, 10);
        if (!isNaN(parsed)) {
            diasSemAcessoNum = parsed;
        }
    } else {
        // Se vazio, significa nunca acessou. Vamos colocar um valor alto para destacar no dashboard, ou null
        // No painel do index: dadosDiasAcesso[row.Docente].maxDias = dias;
        diasSemAcessoNum = 999; // Simboliza nunca acessou / muito tempo
    }

    // Garante que o campo 'Módulo' exista mesmo que venha como 'Modulo' da planilha
    const moduloValue = row['Módulo'] || row['Modulo'];

    // Mapeamento extra para nomes de coluna que podem vir um pouco diferentes da planilha
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
