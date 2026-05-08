const { google } = require('googleapis');

async function getSheetsData() {
  const credentialsJson = process.env.GOOGLE_CREDENTIALS;
  const spreadsheetId = process.env.SPREADSHEET_ID;

  if (!credentialsJson || !spreadsheetId) {
      console.warn("Faltando GOOGLE_CREDENTIALS ou SPREADSHEET_ID. Retornando array vazio.");
      return [];
  }

  try {
    const credentials = JSON.parse(credentialsJson);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Pega os dados da primeira aba (Sheet1) na primeira chamada para descobrir o nome da aba e ler os dados.
    const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId,
        includeGridData: false
    });

    // Obter o nome da primeira aba
    const sheetName = spreadsheet.data.sheets[0].properties.title;
    console.log(`Lendo dados da aba: ${sheetName}`);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:Z`,
    });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      console.log('Nenhum dado encontrado na planilha.');
      return [];
    }

    // A primeira linha são os cabeçalhos
    const headers = rows[0].map(h => h ? h.trim() : '');

    const jsonData = [];

    // Ignora a primeira linha (cabeçalhos)
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];

        // Verifica se a linha está completamente vazia
        if (!row || row.length === 0 || row.every(cell => !cell || cell.trim() === '')) {
             continue;
        }

        const obj = {};
        headers.forEach((header, index) => {
            if (header) {
                obj[header] = row[index] || '';
            }
        });
        jsonData.push(obj);
    }

    return jsonData;

  } catch (error) {
    console.error('Erro ao ler a planilha do Google Sheets:', error);
    throw error;
  }
}

module.exports = {
  getSheetsData
};
