const { google } = require("googleapis");

const COLUNAS = {
  DOCENTE: "Docente",
  EMAIL_DOCENTE: "email_docente",
  COORDENADOR: "Coordenador",
  EMAIL_COORDENADOR: "email_coordenador",
  DISCIPLINA: "Disciplina",
  ATIVIDADE: "Atividade",
  MODALIDADE: "Modalidade",
  CURSO: "Curso",
  STATUS_CALCULADO: "statusCalculado",
  DIAS_SEM_ACESSO: "Dias s/ Acesso",
};

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "https://developers.google.com/oauthplayground"
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const gmail = google.gmail({
  version: "v1",
  auth: oauth2Client,
});

const REMETENTE_OFICIAL = "Equipe NED <ned@unifenas.br>";

/**
 * Corrige a acentuação no assunto do e-mail codificando para Base64 (MIME)
 */
function formatarAssunto(assunto) {
  const base64Subject = Buffer.from(assunto).toString("base64");
  return `=?utf-8?B?${base64Subject}?=`;
}

async function enviarEmail(destinatario, assunto, corpoTexto) {
  try {
    const assuntoFormatado = formatarAssunto(assunto);

    const email = [
      `From: ${REMETENTE_OFICIAL}`,
      `To: ${destinatario}`,
      `Subject: ${assuntoFormatado}`,
      "Content-Type: text/plain; charset=utf-8",
      "MIME-Version: 1.0",
      "",
      corpoTexto,
    ].join("\n");

    const encodedMessage = Buffer.from(email)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
      },
    });

    console.log(`[EMAIL] Sucesso: ${assunto} -> ${destinatario}`);
    return true;
  } catch (error) {
    console.error("[EMAIL] ERRO:", error?.response?.data || error);
    return false;
  }
}

// ==========================================
// COORDENADORES
// ==========================================

async function notificarCoordenadores(dados) {
  const pendenciasPorCoordenador = dados.reduce((acc, item) => {
    const nomeCoord = item[COLUNAS.COORDENADOR];
    const emailCoord = item[COLUNAS.EMAIL_COORDENADOR];
    const curso = item[COLUNAS.CURSO];
    const docente = item[COLUNAS.DOCENTE];

    if (!nomeCoord || !emailCoord) return acc;
    if (!acc[emailCoord]) acc[emailCoord] = { nome: nomeCoord, cursos: {} };
    if (!acc[emailCoord].cursos[curso]) acc[emailCoord].cursos[curso] = {};
    if (!acc[emailCoord].cursos[curso][docente]) acc[emailCoord].cursos[curso][docente] = [];

    acc[emailCoord].cursos[curso][docente].push(item);
    return acc;
  }, {});

  let envios = 0;
  for (const email in pendenciasPorCoordenador) {
    const info = pendenciasPorCoordenador[email];
    let corpo = `Olá, Coordenador(a) ${info.nome}.\n\n`;
    corpo += `Encaminhamos o relatório consolidado de pendências identificadas em seus cursos. Solicitamos o seu apoio na mediação com os docentes para a regularização dos itens listados abaixo:\n\n`;

    for (const curso in info.cursos) {
      corpo += `----------------------------------------\n`;
      corpo += `CURSO: ${curso}\n`;
      corpo += `----------------------------------------\n\n`;
      for (const docente in info.cursos[curso]) {
        corpo += `• Docente: ${docente}\n`;
        info.cursos[curso][docente].forEach(i => {
          corpo += `  - Disciplina: ${i[COLUNAS.DISCIPLINA]}\n`;
          corpo += `  - Item: ${i[COLUNAS.ATIVIDADE]}\n`;
          corpo += `  - Situação: ${i[COLUNAS.STATUS_CALCULADO]}\n\n`;
        });
      }
    }
    corpo += `Estamos à disposição para eventuais dúvidas.\n\nAtenciosamente,\nEquipe NED`;

    if (await enviarEmail(email, "Relatório de Pendências Acadêmicas - Cursos", corpo)) envios++;
  }
  return `E-mails enviados para ${envios} coordenador(es).`;
}

// ==========================================
// DOCENTES (PENDÊNCIAS GERAIS)
// ==========================================

async function notificarDocentes(dados) {
  const pendenciasPorDocente = dados.reduce((acc, item) => {
    const nome = item[COLUNAS.DOCENTE];
    const email = item[COLUNAS.EMAIL_DOCENTE];
    if (!nome || !email) return acc;
    if (!acc[nome]) acc[nome] = { email, atividades: [] };
    acc[nome].atividades.push(item);
    return acc;
  }, {});

  let envios = 0;
  for (const nome in pendenciasPorDocente) {
    const info = pendenciasPorDocente[nome];
    let corpo = `Prezado(a) Professor(a) ${nome}.\n\n`;
    corpo += `Identificamos as seguintes pendências acadêmicas em nosso sistema que precisam de sua atenção para o bom andamento das disciplinas:\n\n`;

    info.atividades.forEach(i => {
      corpo += `› Disciplina: ${i[COLUNAS.DISCIPLINA]}\n`;
      corpo += `  - Atividade: ${i[COLUNAS.ATIVIDADE]}\n`;
      corpo += `  - Situação: ${i[COLUNAS.STATUS_CALCULADO]}\n\n`;
    });

    corpo += `Caso a regularização já tenha sido efetuada, favor desconsiderar este e-mail.\n\nAtenciosamente,\nEquipe NED`;

    if (await enviarEmail(info.email, "Notificação de Pendências Acadêmicas", corpo)) envios++;
  }
  return `E-mails enviados para ${envios} docente(s).`;
}

// ==========================================
// COBRANÇA DE MATERIAL (UAs)
// ==========================================

async function cobrarUasPendentes(dados) {
  // Filtra itens que são especificamente de envio de material/UA
  const uasPorDocente = dados.reduce((acc, item) => {
    const nome = item[COLUNAS.DOCENTE];
    const email = item[COLUNAS.EMAIL_DOCENTE];
    if (!nome || !email) return acc;
    if (!acc[nome]) acc[nome] = { email, disciplinas: [] };
    
    // Evita duplicar disciplinas na lista
    if (!acc[nome].disciplinas.includes(item[COLUNAS.DISCIPLINA])) {
        acc[nome].disciplinas.push(item[COLUNAS.DISCIPLINA]);
    }
    return acc;
  }, {});

  let envios = 0;
  for (const nome in uasPorDocente) {
    const info = uasPorDocente[nome];
    let corpo = `Olá, Professor(a) ${nome}.\n\n`;
    corpo += `Solicitamos o envio do material das Unidades de Aprendizagem (UAs) para as disciplinas listadas abaixo. O recebimento deste conteúdo é essencial para a preparação do Ambiente Virtual de Aprendizagem (AVA):\n\n`;
    
    info.disciplinas.forEach(d => corpo += `- ${d}\n`);

    corpo += `\nFavor nos informar a previsão de envio ou encaminhar os arquivos o quanto antes para evitarmos atrasos na liberação aos alunos.\n\nAtenciosamente,\nEquipe NED`;

    if (await enviarEmail(info.email, "Solicitação de Material Didático (UAs)", corpo)) envios++;
  }
  return `E-mails de cobrança enviados para ${envios} docente(s).`;
}

module.exports = {
  notificarCoordenadores,
  notificarDocentes,
  cobrarUasPendentes,
};