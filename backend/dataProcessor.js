// A função `parseDate` foi removida, pois a lógica de datas complexas
// foi transferida para a consulta SQL ou não é mais aplicável com os dados do Moodle.

// Função principal que processa os dados brutos vindos do Moodle
const processData = (data) => {

  // Mapeia os dados recebidos do banco para o formato esperado pelo frontend
  return data.map((row) => {
    
    // A lógica de status agora é baseada diretamente na coluna 'Entregue' da query
    const statusDaQuery = row['Entregue']; // Ex: 'Entregue', 'Não Entregue', 'N/A'

    let statusCalculado = 'Status Desconhecido';
    let isPendente = false;
    let isEntregueNoPrazo = false;

    if (statusDaQuery === 'Entregue') {
      statusCalculado = 'Entregue';
      isEntregueNoPrazo = true;
      isPendente = false;
    } else if (statusDaQuery === 'Não Entregue') {
      statusCalculado = 'Pendente';
      isPendente = true;
      isEntregueNoPrazo = false;
    } else {
      // Para casos como 'N/A' ou outros valores inesperados
      statusCalculado = 'Indefinido';
      isPendente = true; // Assume-se como pendente se não for explicitamente entregue
      isEntregueNoPrazo = false;
    }
          
    // Normaliza o campo 'Dias s/ Acesso' para garantir que seja sempre um número
    const diasSemAcessoStr = row['Dias s/ Acesso'];
    let diasSemAcessoNum = 0;
    if (diasSemAcessoStr && !isNaN(Number(diasSemAcessoStr))) {
      diasSemAcessoNum = parseInt(diasSemAcessoStr, 10);
    }

    // Retorna a estrutura de dados final, combinando os dados da query
    // com os campos calculados que o frontend espera.
    return {
      ...row,
      'Dias s/ Acesso': diasSemAcessoNum,

      // Campos que o frontend espera, agora com valores padrão ou baseados na query
      statusCalculado,
      diasCalculado: 0, // Não temos mais a lógica de dias de atraso
      isPendente,
      isAtrasado: false, // Não temos mais a lógica de atraso
      isEntregueNoPrazo
    };
  });
};

module.exports = { processData };
