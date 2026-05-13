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

// Remetente configurado via variável de ambiente para facilitar manutenção
const REMETENTE_OFICIAL = process.env.EMAIL_SENDER || "Equipe NED <ned@unifenas.br>";

function formatarAssunto(assunto) {
  const base64Subject = Buffer.from(assunto).toString("base64");
  return `=?utf-8?B?${base64Subject}?=`;
}

const ehPendente = (item) => 
  item.isPendente === true || 
  String(item[COLUNAS.STATUS_CALCULADO]).toLowerCase().includes('pendente');

const ehUa = (item) => {
  const nomeAtividade = String(item[COLUNAS.ATIVIDADE] || '').trim().toUpperCase();
  return nomeAtividade === "UA'S ENVIADAS" || nomeAtividade === "UA’S ENVIADAS";
};

function gerarCSV(dados) {
  if (!dados || dados.length === 0) return null;
  const cabecalho = ["Docente", "Curso", "Disciplina", "Atividade", "Situação"].join(";");
  const linhas = dados.map(i => {
    return [
      `"${i[COLUNAS.DOCENTE] || ''}"`,
      `"${i[COLUNAS.CURSO] || ''}"`,
      `"${i[COLUNAS.DISCIPLINA] || ''}"`,
      `"${i[COLUNAS.ATIVIDADE] || ''}"`,
      `"${i[COLUNAS.STATUS_CALCULADO] || ''}"`
    ].join(";");
  });
  return '\uFEFF' + [cabecalho, ...linhas].join('\n');
}

async function enviarEmail(destinatario, assunto, corpoTexto, csvContent = null, csvFilename = "relatorio.csv") {
  try {
    const assuntoFormatado = formatarAssunto(assunto);
    const boundary = "b0undary_" + Date.now();

    let emailLines = [
      `From: ${REMETENTE_OFICIAL}`,
      `To: ${destinatario}`,
      `Subject: ${assuntoFormatado}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset="utf-8"`,
      ``,
      corpoTexto,
      ``
    ];

    if (csvContent) {
      const base64Csv = Buffer.from(csvContent, 'utf-8').toString("base64");
      emailLines = emailLines.concat([
        `--${boundary}`,
        `Content-Type: text/csv; charset="utf-8"; name="${csvFilename}"`,
        `Content-Disposition: attachment; filename="${csvFilename}"`,
        `Content-Transfer-Encoding: base64`,
        ``,
        base64Csv,
        ``
      ]);
    }

    emailLines.push(`--${boundary}--`);

    const encodedMessage = Buffer.from(emailLines.join("\n"))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: encodedMessage },
    });

    console.log(`[EMAIL] Sucesso: ${assunto} -> ${destinatario}`);
    return true;
  } catch (error) {
    console.error("[EMAIL] ERRO:", error?.response?.data || error);
    return false;
  }
}

async function notificarCoordenadores(dados) {
  const pendentes = dados.filter(item => ehPendente(item));

  const porCoordenador = pendentes.reduce((acc, item) => {
    const nome = item[COLUNAS.COORDENADOR];
    const email = item[COLUNAS.EMAIL_COORDENADOR];
    if (!nome || !email) return acc;
    if (!acc[email]) acc[email] = { nome, itens: [] };
    
    acc[email].itens.push(item);
    return acc;
  }, {});

  let envios = 0;
  for (const email in porCoordenador) {
    const info = porCoordenador[email];
    let corpo = `Olá, Coordenador(a) ${info.nome}.\n\n`;
    corpo += `Encaminhamos em anexo a planilha com o relatório consolidado de todas as pendências identificadas nos cursos sob sua responsabilidade.\n\n`;
    corpo += `Solicitamos o seu apoio na mediação com os docentes para a regularização dos itens listados no arquivo.\n\n`;
    corpo += `Estamos à disposição para eventuais dúvidas.\n\nAtenciosamente,\nEquipe NED`;

    const csv = gerarCSV(info.itens);
    if (await enviarEmail(email, "Relatório de Pendências Acadêmicas - Cursos", corpo, csv, "pendencias_cursos.csv")) envios++;
  }
  return `E-mails enviados para ${envios} coordenador(es).`;
}

async function notificarDocentes(dados) {
  const pendentesNaoUas = dados.filter(item => ehPendente(item) && !ehUa(item));

  const porDocente = pendentesNaoUas.reduce((acc, item) => {
    const nome = item[COLUNAS.DOCENTE];
    const email = item[COLUNAS.EMAIL_DOCENTE];
    if (!nome || !email) return acc;
    if (!acc[email]) acc[email] = { nome, itens: [] };
    
    acc[email].itens.push(item);
    return acc;
  }, {});

  let envios = 0;
  for (const email in porDocente) {
    const info = porDocente[email];
    let corpo = `Prezado(a) Professor(a) ${info.nome}.\n\n`;
    corpo += `Identificamos pendências acadêmicas em nosso sistema que precisam de sua atenção para o bom andamento das disciplinas.\n\n`;
    corpo += `Para facilitar a visualização e gestão, anexamos a este e-mail uma planilha contendo o detalhamento de suas atividades pendentes.\n\n`;
    corpo += `Caso a regularização já tenha sido efetuada, favor desconsiderar este aviso.\n\nAtenciosamente,\nEquipe NED`;

    const csv = gerarCSV(info.itens);
    if (await enviarEmail(email, "Notificação de Pendências Acadêmicas", corpo, csv, "minhas_atividades_pendentes.csv")) envios++;
  }
  return `E-mails enviados para ${envios} docente(s).`;
}

async function cobrarUasPendentes(dados) {
  const uasPendentes = dados.filter(item => ehPendente(item) && ehUa(item));

  const uasPorDocente = uasPendentes.reduce((acc, item) => {
    const nome = item[COLUNAS.DOCENTE];
    const email = item[COLUNAS.EMAIL_DOCENTE];
    if (!nome || !email) return acc;
    if (!acc[email]) acc[email] = { nome, disciplinas: [] };
    
    if (!acc[email].disciplinas.includes(item[COLUNAS.DISCIPLINA])) {
        acc[email].disciplinas.push(item[COLUNAS.DISCIPLINA]);
    }
    return acc;
  }, {});

  let envios = 0;
  for (const email in uasPorDocente) {
    const info = uasPorDocente[email];
    let corpo = `Olá, Professor(a) ${info.nome}.\n\n`;
    corpo += `Solicitamos o envio do material das Unidades de Aprendizagem (UAs) para as disciplinas listadas abaixo. O recebimento deste conteúdo é essencial para a preparação do Ambiente Virtual de Aprendizagem (AVA):\n\n`;
    
    info.disciplinas.forEach(d => corpo += `- ${d}\n`);

    corpo += `\nO envio do material deve ser realizado via Lyceum. Pedimos, por gentileza, que o encaminhamento seja feito o quanto antes para evitarmos atrasos na liberação da disciplina aos alunos.\n\nAtenciosamente,\nEquipe NED`;

    if (await enviarEmail(email, "Solicitação de Material Didático (UAs)", corpo)) envios++;
  }
  return `E-mails de cobrança enviados para ${envios} docente(s).`;
}

module.exports = {
  notificarCoordenadores,
  notificarDocentes,
  cobrarUasPendentes,
};