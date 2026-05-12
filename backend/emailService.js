const nodemailer = require('nodemailer');

const COLUNAS = {
  DOCENTE: 'Docente',
  EMAIL_DOCENTE: 'email_docente',
  COORDENADOR: 'Coordenador',
  EMAIL_COORDENADOR: 'email_coordenador',
  DISCIPLINA: 'Disciplina',
  ATIVIDADE: 'Atividade',
  MODALIDADE: 'Modalidade',
  CURSO: 'Curso',
  STATUS_CALCULADO: 'statusCalculado',
  DIAS_SEM_ACESSO: 'Dias s/ Acesso'
};

// Configure o seu transporter aqui (usando a estratégia OAuth2 ou Resend definida anteriormente)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: 'ned@unifenas.br', // IMPORTANTE: Tem que ser EXATAMENTE o email que você autorizou lá no Playground
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
  },
});

const REMETENTE_OFICIAL = 'Equipe NED <ned@unifenas.br>';

// ==========================================
// FUNÇÕES DE ENVIO DE E-MAIL
// ==========================================

async function notificarCoordenadores(dados) {
  const pendenciasPorCoordenador = dados.reduce((acc, item) => {
    const nomeCoordenador = item[COLUNAS.COORDENADOR];
    const emailCoordenador = item[COLUNAS.EMAIL_COORDENADOR];
    const nomeCurso = item[COLUNAS.CURSO];
    const nomeDocente = item[COLUNAS.DOCENTE];

    if (!nomeCoordenador || !emailCoordenador || !nomeCurso || !nomeDocente) return acc;

    if (!acc[emailCoordenador]) acc[emailCoordenador] = { nome: nomeCoordenador, cursos: {} };
    if (!acc[emailCoordenador].cursos[nomeCurso]) acc[emailCoordenador].cursos[nomeCurso] = {};
    if (!acc[emailCoordenador].cursos[nomeCurso][nomeDocente]) acc[emailCoordenador].cursos[nomeCurso][nomeDocente] = [];

    acc[emailCoordenador].cursos[nomeCurso][nomeDocente].push(item);
    return acc;
  }, {});

  let enviosComSucesso = 0;

  for (const email in pendenciasPorCoordenador) {
    const infoCoordenador = pendenciasPorCoordenador[email];
    let corpoEmail = '';

    corpoEmail += `Olá, Coordenador(a) ${infoCoordenador.nome}, tudo bem?\n\n`;
    corpoEmail += `Para te auxiliar no acompanhamento acadêmico, preparamos um resumo dos pontos que merecem atenção em seus cursos esta semana.\n\n`;

    for (const nomeCurso in infoCoordenador.cursos) {
      corpoEmail += `========================================\n`;
      corpoEmail += `RESUMO DO CURSO: ${nomeCurso}\n`;
      corpoEmail += `========================================\n\n`;

      const docentesDoCurso = infoCoordenador.cursos[nomeCurso];

      for (const nomeDocente in docentesDoCurso) {
        corpoEmail += `• Docente: ${nomeDocente}\n`;
        const atividadesDoDocente = docentesDoCurso[nomeDocente];

        atividadesDoDocente.forEach(item => {
          corpoEmail += `  - Disciplina: ${item[COLUNAS.DISCIPLINA]}\n`;
          corpoEmail += `  - Item pendente: ${item[COLUNAS.ATIVIDADE]}\n`;
          corpoEmail += `  - Situação: ${item[COLUNAS.STATUS_CALCULADO]}\n\n`;
        });
      }
    }

    corpoEmail += `Agradecemos se puder conversar com os docentes para entender e auxiliar na regularização das pendências.\n`;
    corpoEmail += `Qualquer apoio que precisar de nossa parte, é só chamar.\n\n`;
    corpoEmail += `Um abraço,\nEquipe NED`;

    try {
      await transporter.sendMail({
        from: REMETENTE_OFICIAL,
        to: email,
        subject: `Acompanhamento de pendências dos cursos`,
        text: corpoEmail // Usando 'text' porque a formatação original é em texto plano (com \n)
      });
      enviosComSucesso++;
    } catch (error) {
      console.error(`Erro ao enviar para coordenador ${email}:`, error);
    }
  }

  return `E-mails para ${enviosComSucesso} coordenador(es) enviados com sucesso.`;
}

async function notificarDocentes(dados) {
  const pendenciasPorDocente = dados.reduce((acc, item) => {
    const nomeDocente = item[COLUNAS.DOCENTE];
    const emailDocente = item[COLUNAS.EMAIL_DOCENTE];
    
    if (!nomeDocente || !emailDocente) return acc;
    if (!acc[nomeDocente]) acc[nomeDocente] = { email: emailDocente, atividades: [] };
    
    acc[nomeDocente].atividades.push(item);
    return acc;
  }, {});

  let enviosComSucesso = 0;

  for (const nomeDocente in pendenciasPorDocente) {
    const info = pendenciasPorDocente[nomeDocente];
    let corpoEmail = '';

    corpoEmail += `Prezado(a) Professor(a) ${nomeDocente},\n\n`;
    corpoEmail += `Com o objetivo de manter a organização e o bom andamento das disciplinas, enviamos abaixo um resumo de suas atividades com pendências em nosso sistema.\n\n`;
    corpoEmail += `Segue o detalhamento:\n\n`;

    info.atividades.forEach(item => {
      corpoEmail += `› Disciplina: ${item[COLUNAS.DISCIPLINA]}\n`;
      corpoEmail += `  - Atividade: ${item[COLUNAS.ATIVIDADE]}\n`;
      corpoEmail += `  - Situação: ${item[COLUNAS.STATUS_CALCULADO]}\n\n`;
    });

    corpoEmail += `A sua atenção a estes pontos é importante para o acompanhamento dos alunos. Agradecemos a sua colaboração para regularizar a situação.\n\n`;
    corpoEmail += `Caso já tenha realizado os ajustes, por favor, desconsidere esta notificação.\n\n`;
    corpoEmail += `Atenciosamente,\nEquipe NED`;

    try {
      await transporter.sendMail({
        from: REMETENTE_OFICIAL,
        to: info.email,
        subject: `Notificação de Pendências em Atividades Acadêmicas`,
        text: corpoEmail
      });
      enviosComSucesso++;
    } catch (error) {
      console.error(`Erro ao enviar para docente ${info.email}:`, error);
    }
  }

  return `E-mails para ${enviosComSucesso} docente(s) enviados com sucesso.`;
}

async function cobrarUasPendentes(dados) {
  // Ajuste o nome da propriedade isPendente caso no seu frontend seja diferente
  const uasPendentes = dados.filter(item => item[COLUNAS.ATIVIDADE] === "UA'S ENVIADAS" && item.isPendente);

  const uasPorDocente = uasPendentes.reduce((acc, item) => {
    const nomeDocente = item[COLUNAS.DOCENTE];
    const emailDocente = item[COLUNAS.EMAIL_DOCENTE];
    
    if (!nomeDocente || !emailDocente) return acc;
    if (!acc[nomeDocente]) acc[nomeDocente] = { email: emailDocente, disciplinas: [] };
    
    acc[nomeDocente].disciplinas.push(item[COLUNAS.DISCIPLINA]);
    return acc;
  }, {});

  let enviosComSucesso = 0;

  for (const nomeDocente in uasPorDocente) {
    const info = uasPorDocente[nomeDocente];
    const listaDisciplinas = info.disciplinas.join('\n- ');
    let corpoEmail = '';

    corpoEmail += `Olá, Professor(a) ${nomeDocente}, tudo bem?\n\n`;
    corpoEmail += `Sabemos que o dia a dia é sempre uma correria e, para te ajudar a organizar, estamos passando para verificar o andamento do envio do material das UAs (Unidades de Aprendizagem).\n\n`;
    corpoEmail += `Para que possamos preparar o Ambiente Virtual de Aprendizagem para os alunos, estamos aguardando o material das seguintes disciplinas:\n\n`;
    corpoEmail += `- ${listaDisciplinas}\n\n`;
    corpoEmail += `Assim que tiver uma previsão ou puder nos enviar o material, ficaremos muito gratos. Isso nos ajuda a garantir que tudo esteja pronto para os estudantes.\n\n`;
    corpoEmail += `Se precisar de qualquer ajuda, é só nos chamar!\n\n`;
    corpoEmail += `Um abraço,\nEquipe NED`;

    try {
      await transporter.sendMail({
        from: REMETENTE_OFICIAL,
        to: info.email,
        subject: `Sobre o envio do material (UAs)`,
        text: corpoEmail
      });
      enviosComSucesso++;
    } catch (error) {
      console.error(`Erro ao cobrar UAs do docente ${info.email}:`, error);
    }
  }

  return `E-mails de cobrança de UAs para ${enviosComSucesso} docente(s) enviados com sucesso.`;
}

// Exportando os módulos para serem usados no server.js
module.exports = {
  notificarCoordenadores,
  notificarDocentes,
  cobrarUasPendentes
};