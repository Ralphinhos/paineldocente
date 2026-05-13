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

async function enviarEmail(destinatario, assunto, corpoTexto) {
  try {
    console.log("[EMAIL] =====================");
    console.log("[EMAIL] Preparando envio");
    console.log("[EMAIL] Para:", destinatario);

    const email = [
      `From: ${REMETENTE_OFICIAL}`,
      `To: ${destinatario}`,
      `Subject: ${assunto}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      corpoTexto,
    ].join("\n");

    const encodedMessage = Buffer.from(email)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    console.log("[EMAIL] Enviando via Gmail API...");

    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
      },
    });

    console.log("[EMAIL] SUCESSO!");
    console.log("[EMAIL] Message ID:", response.data.id);

    return true;
  } catch (error) {
    console.error("[EMAIL] ERRO AO ENVIAR");
    console.error(error?.response?.data || error);

    return false;
  }
}

// ==========================================
// COORDENADORES
// ==========================================

async function notificarCoordenadores(dados) {
  const pendenciasPorCoordenador = dados.reduce((acc, item) => {
    const nomeCoordenador = item[COLUNAS.COORDENADOR];
    const emailCoordenador = item[COLUNAS.EMAIL_COORDENADOR];
    const nomeCurso = item[COLUNAS.CURSO];
    const nomeDocente = item[COLUNAS.DOCENTE];

    if (!nomeCoordenador || !emailCoordenador || !nomeCurso || !nomeDocente)
      return acc;

    if (!acc[emailCoordenador]) {
      acc[emailCoordenador] = {
        nome: nomeCoordenador,
        cursos: {},
      };
    }

    if (!acc[emailCoordenador].cursos[nomeCurso]) {
      acc[emailCoordenador].cursos[nomeCurso] = {};
    }

    if (
      !acc[emailCoordenador].cursos[nomeCurso][nomeDocente]
    ) {
      acc[emailCoordenador].cursos[nomeCurso][
        nomeDocente
      ] = [];
    }

    acc[emailCoordenador].cursos[nomeCurso][
      nomeDocente
    ].push(item);

    return acc;
  }, {});

  let enviosComSucesso = 0;

  for (const email in pendenciasPorCoordenador) {
    const info = pendenciasPorCoordenador[email];

    let corpoEmail = "";

    corpoEmail += `Olá, Coordenador(a) ${info.nome}, tudo bem?\n\n`;

    corpoEmail += `Segue um resumo das pendências identificadas:\n\n`;

    for (const nomeCurso in info.cursos) {
      corpoEmail += `========================================\n`;
      corpoEmail += `CURSO: ${nomeCurso}\n`;
      corpoEmail += `========================================\n\n`;

      const docentes = info.cursos[nomeCurso];

      for (const nomeDocente in docentes) {
        corpoEmail += `• Docente: ${nomeDocente}\n`;

        docentes[nomeDocente].forEach((item) => {
          corpoEmail += `  - Disciplina: ${item[COLUNAS.DISCIPLINA]}\n`;
          corpoEmail += `  - Pendência: ${item[COLUNAS.ATIVIDADE]}\n`;
          corpoEmail += `  - Situação: ${item[COLUNAS.STATUS_CALCULADO]}\n\n`;
        });
      }
    }

    corpoEmail += `Atenciosamente,\nEquipe NED`;

    const sucesso = await enviarEmail(
      email,
      "Acompanhamento de pendências dos cursos",
      corpoEmail
    );

    if (sucesso) {
      enviosComSucesso++;
    }
  }

  return `E-mails para ${enviosComSucesso} coordenador(es) enviados com sucesso.`;
}

// ==========================================
// DOCENTES
// ==========================================

async function notificarDocentes(dados) {
  const pendenciasPorDocente = dados.reduce((acc, item) => {
    const nomeDocente = item[COLUNAS.DOCENTE];
    const emailDocente = item[COLUNAS.EMAIL_DOCENTE];

    if (!nomeDocente || !emailDocente) return acc;

    if (!acc[nomeDocente]) {
      acc[nomeDocente] = {
        email: emailDocente,
        atividades: [],
      };
    }

    acc[nomeDocente].atividades.push(item);

    return acc;
  }, {});

  let enviosComSucesso = 0;

  for (const nomeDocente in pendenciasPorDocente) {
    const info = pendenciasPorDocente[nomeDocente];

    let corpoEmail = "";

    corpoEmail += `Prezado(a) Professor(a) ${nomeDocente},\n\n`;

    corpoEmail += `Segue abaixo um resumo das pendências identificadas:\n\n`;

    info.atividades.forEach((item) => {
      corpoEmail += `› Disciplina: ${item[COLUNAS.DISCIPLINA]}\n`;
      corpoEmail += `  - Atividade: ${item[COLUNAS.ATIVIDADE]}\n`;
      corpoEmail += `  - Situação: ${item[COLUNAS.STATUS_CALCULADO]}\n\n`;
    });

    corpoEmail += `Atenciosamente,\nEquipe NED`;

    const sucesso = await enviarEmail(
      info.email,
      "Notificação de Pendências Acadêmicas",
      corpoEmail
    );

    if (sucesso) {
      enviosComSucesso++;
    }
  }

  return `E-mails para ${enviosComSucesso} docente(s) enviados com sucesso.`;
}

// ==========================================
// COBRANÇA DE UAS PENDENTES
// ==========================================

async function cobrarUasPendentes(dados) {
  const pendenciasPorDocente = dados.reduce((acc, item) => {
    const nomeDocente = item[COLUNAS.DOCENTE];
    const emailDocente = item[COLUNAS.EMAIL_DOCENTE];

    if (!nomeDocente || !emailDocente) return acc;

    if (!acc[nomeDocente]) {
      acc[nomeDocente] = {
        email: emailDocente,
        atividades: [],
      };
    }

    acc[nomeDocente].atividades.push(item);

    return acc;
  }, {});

  let enviosComSucesso = 0;

  for (const nomeDocente in pendenciasPorDocente) {
    const info = pendenciasPorDocente[nomeDocente];

    let corpoEmail = "";

    corpoEmail += `Prezado(a) Professor(a) ${nomeDocente},\n\n`;

    corpoEmail += `Verificamos em nosso sistema que existem pendências relacionadas a UAs (Unidades de Aprendizagem) ou outras atividades em suas disciplinas:\n\n`;

    info.atividades.forEach((item) => {
      corpoEmail += `› Disciplina: ${item[COLUNAS.DISCIPLINA]}\n`;
      corpoEmail += `  - Atividade/UA: ${item[COLUNAS.ATIVIDADE]}\n`;
      corpoEmail += `  - Situação: ${item[COLUNAS.STATUS_CALCULADO]}\n\n`;
    });

    corpoEmail += `Pedimos a gentileza de regularizar essas situações o mais breve possível. Caso já tenha regularizado, por favor desconsidere este aviso.\n\n`;

    corpoEmail += `Atenciosamente,\nEquipe NED`;

    const sucesso = await enviarEmail(
      info.email,
      "Aviso Importante: UAs e Atividades Pendentes",
      corpoEmail
    );

    if (sucesso) {
      enviosComSucesso++;
    }
  }

  return `E-mails de cobrança para ${enviosComSucesso} docente(s) enviados com sucesso.`;
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  notificarCoordenadores,
  notificarDocentes,
  cobrarUasPendentes,
};