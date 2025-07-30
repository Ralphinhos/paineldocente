// Função para validar e converter strings de data no formato 'DD/MM/YYYY' para objetos Date
const parseDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string' || !/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    return null;
  }
  const [day, month, year] = dateStr.split('/');
  const numMonth = parseInt(month, 10) - 1; 
  const numDay = parseInt(day, 10);
  const numYear = parseInt(year, 10);

  if (numMonth < 0 || numMonth > 11 || numDay < 1 || numDay > 31 || numYear < 1900 || numYear > 2100) {
    return null;
  }
  const dateObj = new Date(numYear, numMonth, numDay);
  if (dateObj.getFullYear() !== numYear || dateObj.getMonth() !== numMonth || dateObj.getDate() !== numDay) {
    return null;
  }
  return dateObj;
};

// Função principal que processa os dados brutos (que virão do banco de dados)
const processData = (data) => {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return data.map((row) => {
    // Os nomes das colunas (row['Data Limite Construção']) devem corresponder aos nomes dos campos do banco de dados
    const dataLimiteConstrucaoStr = row['Data Limite Construção']; 
    const dataEntregaStr = row['Entregue']; 
    
    const dataLimite = parseDate(dataLimiteConstrucaoStr);
    const dataEntrega = parseDate(dataEntregaStr);
   
    let statusCalculado = '';
    let diasCalculado = 0; 
    let isPendente = false;
    let isAtrasado = false;
    let isEntregueNoPrazo = false;

    const entregueSim = dataEntrega !== null;

    if (entregueSim) {
      isPendente = false;
      if (dataLimite && dataEntrega > dataLimite) {
        isAtrasado = true;
        isEntregueNoPrazo = false;
        diasCalculado = Math.ceil((dataEntrega.getTime() - dataLimite.getTime()) / (1000 * 60 * 60 * 24));
        statusCalculado = `Entregue com ${diasCalculado} dia(s) de atraso`;
      } else {
        isAtrasado = false;
        isEntregueNoPrazo = true;
        statusCalculado = 'Entregue no prazo';
        if (dataLimite) {
          diasCalculado = Math.ceil((dataEntrega.getTime() - dataLimite.getTime()) / (1000 * 60 * 60 * 24));
        } else {
          diasCalculado = 0;
        }
      }
    } else {
      isPendente = true;
      isAtrasado = false;
      isEntregueNoPrazo = false;
      if (dataLimite && hoje > dataLimite) {
        diasCalculado = Math.ceil((hoje.getTime() - dataLimite.getTime()) / (1000 * 60 * 60 * 24));
        statusCalculado = `Pendente há ${diasCalculado} dia(s)`;
      } else if (dataLimite) {
        statusCalculado = 'Pendente';
        diasCalculado = 0;
      } else {
        statusCalculado = 'Pendente (sem data limite)';
        diasCalculado = 0;
      }
    }
          
    const diasSemAcessoStr = row['Dias s/ Acesso'];
    let diasSemAcessoNum = 0;
    if (diasSemAcessoStr && !isNaN(Number(diasSemAcessoStr))) {
      diasSemAcessoNum = parseInt(diasSemAcessoStr, 10);
    }

    const dataTerminoPrevistoStr = row['DataTerminoPrevisto'];
    const dataTerminoPrevisto = dataTerminoPrevistoStr ? parseDate(dataTerminoPrevistoStr) : null;

    const dataInicioSemestreStr = row['DataInicioSemestre'];
    const dataInicioSemestre = dataInicioSemestreStr ? parseDate(dataInicioSemestreStr) : null;
    
    return {
      ...row,
      'Dias s/ Acesso': diasSemAcessoNum,
      DataTerminoPrevisto: dataTerminoPrevisto,
      DataInicioSemestre: dataInicioSemestre,
      statusCalculado,
      diasCalculado,
      isPendente,
      isAtrasado,
      isEntregueNoPrazo
    };
  });
};

module.exports = { processData };
