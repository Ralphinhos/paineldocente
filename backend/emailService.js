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

const GMAIL_USER = process.env.GMAIL_USER ? process.env.GMAIL_USER.trim().toLowerCase() : "";
const REMETENTE_OFICIAL = GMAIL_USER ? `Equipe NED <${GMAIL_USER}>` : "Equipe NED <ned@unifenas.br>";

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

async function enviarEmail(destinatario, assunto, corpoTexto, csvContent = null, csvFilename = "relatorio.csv", cc = "", replyTo = "") {
  try {
    const assuntoFormatado = formatarAssunto(assunto);
    const boundary = "b0undary_" + Date.now();

    let emailLines = [
      `From: ${REMETENTE_OFICIAL}`,
      `To: ${destinatario}`,
    ];

    if (cc) emailLines.push(`Cc: ${cc}`);
    if (replyTo) emailLines.push(`Reply-To: ${replyTo}`);

    emailLines = emailLines.concat([
      `Subject: ${assuntoFormatado}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset="utf-8"`,
      ``,
      corpoTexto,
      ``
    ]);

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

    return true;
  } catch (error) {
    console.error("[EMAIL] ERRO no disparo:", error?.response?.data || error.message);
    return false;
  }
}

async function notificarCoordenadores(dados) {
  const pendentes = dados.filter(item => ehPendente(item));

  const porCoordenador = pendentes.reduce((acc, item) => {
    const nome = item[COLUNAS.COORDENADOR];
    const emailStr = String(item[COLUNAS.EMAIL_COORDENADOR] || "").split(/[,;\s\n\r|]+/)[0];
    const email = emailStr && emailStr.includes('@') ? emailStr : null;

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
    
    let finalCcSet = new Set();
    const fixos = process.env.EMAIL_CC_FIXO_GLOBAL || "";
    if (fixos) {
      String(fixos).split(/[,;\s\n\r|]+/).map(e => e.trim().toLowerCase()).filter(e => e.includes('@')).forEach(f => finalCcSet.add(f));
    }
    const ccList = Array.from(finalCcSet).join(", ");

    if (await enviarEmail(email, "Relatório de Pendências Acadêmicas - Cursos", corpo, csv, "pendencias_cursos.csv", ccList)) envios++;
  }
  return `E-mails enviados para ${envios} coordenador(es).`;
}

async function notificarDocentes(dados, remetente = null) {
  const pendentesNaoUas = dados.filter(item => ehPendente(item) && !ehUa(item));

  const porDocente = pendentesNaoUas.reduce((acc, item) => {
    const nome = item[COLUNAS.DOCENTE];
    const email = item[COLUNAS.EMAIL_DOCENTE];
    const emailsCoord = item[COLUNAS.EMAIL_COORDENADOR] || "";

    if (!nome || !email) return acc;
    
    if (!acc[email]) acc[email] = { nome, itens: [], ccCoords: new Set() };
    acc[email].itens.push(item);

    const coords = String(emailsCoord)
      .split(/[,;\s\n\r|]+/)
      .map(e => e.trim().toLowerCase())
      .filter(e => e.includes('@')); 

    coords.forEach(c => acc[email].ccCoords.add(c));
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
    
    let finalCcSet = new Set();
    
    // 1. Adiciona os e-mails dos coordenadores encontrados na planilha para a disciplina
    info.ccCoords.forEach(c => finalCcSet.add(c));

    // 2. Adiciona SEMPRE os E-mails Fixos configurados no Render
    const fixos = process.env.EMAIL_CC_FIXO_GLOBAL || "";
    if (fixos) {
      String(fixos)
        .split(/[,;\s\n\r|]+/)
        .map(e => e.trim().toLowerCase())
        .filter(e => e.includes('@'))
        .forEach(f => finalCcSet.add(f));
    }

    let replyToEmail = "";

    // 3. Regras Específicas do Perfil Logado
    if (remetente && remetente.role === 'coordinator') {
      // Se for coordenador usando o painel, a central (GMAIL_USER) também recebe cópia obrigatoriamente
      if (GMAIL_USER) finalCcSet.add(GMAIL_USER);

      const arrCoords = Array.from(info.ccCoords);
      const emailCorrespondente = arrCoords.find(c => remetente.username && c.includes(remetente.username.toLowerCase()));
      replyToEmail = emailCorrespondente || (remetente.username ? `${remetente.username}@unifenas.br` : arrCoords[0]);
    }

    const ccList = Array.from(finalCcSet).join(", "); 
    
    // Os logs abaixo vão aparecer no terminal do Render para você conferir quem de fato entrou no pacote
    console.log(`[DEBUG] Fixos lidos do Render: ${fixos}`);
    console.log(`[DEBUG - ENVIO DOCENTE] To: ${email} | Cc: ${ccList} | Reply-To: ${replyToEmail}`);

    if (await enviarEmail(email, "Notificação de Pendências Acadêmicas", corpo, csv, "minhas_atividades_pendentes.csv", ccList, replyToEmail)) {
        envios++;
    }
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

    let finalCcSet = new Set();
    const fixos = process.env.EMAIL_CC_FIXO_GLOBAL || "";
    if (fixos) {
      String(fixos).split(/[,;\s\n\r|]+/).map(e => e.trim().toLowerCase()).filter(e => e.includes('@')).forEach(f => finalCcSet.add(f));
    }
    const ccList = Array.from(finalCcSet).join(", ");

    if (await enviarEmail(email, "Solicitação de Material Didático (UAs)", corpo, null, null, ccList)) envios++;
  }
  return `E-mails de cobrança enviados para ${envios} docente(s).`;
}

module.exports = {
  notificarCoordenadores,
  notificarDocentes,
  cobrarUasPendentes,
};