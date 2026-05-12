const { google } = require('googleapis');

let sheetsCache = null;
let sheetNameCache = null;
let lastFetch = 0;

const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

async function getSheetsData() {
  const credentialsJson = process.env.GOOGLE_CREDENTIALS;
  const spreadsheetId = process.env.SPREADSHEET_ID;

  if (!credentialsJson || !spreadsheetId) {
    console.warn(
      'Faltando GOOGLE_CREDENTIALS ou SPREADSHEET_ID. Retornando array vazio.'
    );

    return [];
  }

  // Cache em memória
  if (
    sheetsCache &&
    (Date.now() - lastFetch < CACHE_TTL)
  ) {
    console.log(
      'Servindo dados do Google Sheets via cache'
    );

    return sheetsCache;
  }

  try {
    const credentials = JSON.parse(credentialsJson);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets.readonly'
      ]
    });

    const sheets = google.sheets({
      version: 'v4',
      auth
    });

    // Descobre nome da aba apenas uma vez
    if (!sheetNameCache) {
      const spreadsheet =
        await sheets.spreadsheets.get({
          spreadsheetId,
          includeGridData: false
        });

      sheetNameCache =
        spreadsheet.data.sheets[0].properties.title;
    }

    console.log(
      `Buscando dados da API: Aba ${sheetNameCache}`
    );

    const response =
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetNameCache}!A1:Z`
      });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      console.log(
        'Nenhum dado encontrado na planilha.'
      );

      return [];
    }

    const headers = rows[0].map(h =>
      h ? h.trim() : ''
    );

    const jsonData = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];

      const linhaVazia =
        !row ||
        row.length === 0 ||
        row.every(
          cell =>
            !cell ||
            cell.toString().trim() === ''
        );

      if (linhaVazia) continue;

      const obj = {};

      headers.forEach((header, index) => {
        if (header) {
          obj[header] = row[index] || '';
        }
      });

      jsonData.push(obj);
    }

    // Salva cache
    sheetsCache = jsonData;
    lastFetch = Date.now();

    return jsonData;

  } catch (error) {
    console.error(
      'Erro ao ler a planilha:',
      error
    );

    // fallback cache caso Google falhe
    if (sheetsCache) {
      return sheetsCache;
    }

    throw error;
  }
}

module.exports = {
  getSheetsData
};